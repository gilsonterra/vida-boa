import { addDays, daysBetween } from '../../domain/dates';
import { stableUuid } from '../../domain/ids';
import { dueOccurrences } from '../../domain/recurrence';
import { SEED_ACCOUNT_TYPES, SEED_CATEGORIES, SEED_RULES, SEED_VERSION } from '../../domain/seed';
import type {
	AccountType,
	CategorizationRule,
	Category,
	Entity,
	ID,
	ImportBatch,
	NewEntity,
	RecurringRule,
	Transaction
} from '../../domain/types';
import { notifyChange } from '../changes';
import type {
	Backup,
	DataStore,
	ImportRequest,
	NewTransfer,
	Repository,
	TransactionRepository
} from '../repositories';
import { TABLES, VidaBoaDB } from './db';
import type { EntityTable } from 'dexie';

const BACKUP_VERSION = 1;
const TRANSFER_MATCH_DAYS = 5;

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function stamp<T extends Entity>(data: NewEntity<T>): T {
	const ts = now();
	return { ...data, id: data.id ?? uuid(), createdAt: ts, updatedAt: ts, deletedAt: null } as T;
}

const isLive = <T extends Entity>(x: T) => !x.deletedAt;
const byDateDesc = (a: Transaction, b: Transaction) =>
	b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

/** Repositório genérico com exclusão lógica e aviso de mudança. */
function crudRepository<T extends Entity>(table: EntityTable<T, 'id'>): Repository<T> {
	return {
		async list() {
			return (await table.toArray()).filter(isLive);
		},
		get: (id) => table.get(id as never),
		async create(data) {
			const row = stamp<T>(data);
			await table.add(row as never);
			notifyChange();
			return row;
		},
		async update(id, patch) {
			// O cast é necessário porque o Dexie tipa o patch de forma muito restrita para genéricos.
			await table.update(id as never, { ...patch, updatedAt: now() } as never);
			notifyChange();
		},
		async remove(id) {
			const ts = now();
			await table.update(id as never, { deletedAt: ts, updatedAt: ts } as never);
			notifyChange();
		}
	};
}

export function createDexieStore(db = new VidaBoaDB()): DataStore {
	const base = crudRepository(db.transactions);

	async function partnerOf(t: Transaction): Promise<Transaction | undefined> {
		if (!t.transferId) return undefined;
		const legs = await db.transactions.where('transferId').equals(t.transferId).toArray();
		return legs.find((l) => l.id !== t.id && isLive(l));
	}

	const transactions: TransactionRepository = {
		...base,

		async list(opts = {}) {
			const all = await db.transactions.toArray();
			return (opts.includeDeleted ? all : all.filter(isLive)).sort(byDateDesc);
		},

		async listByAccount(accountId, opts = {}) {
			const rows = await db.transactions.where('accountId').equals(accountId).toArray();
			return (opts.includeDeleted ? rows : rows.filter(isLive)).sort(byDateDesc);
		},

		async update(id, patch) {
			await db.transaction('rw', db.transactions, async () => {
				const t = await db.transactions.get(id);
				if (!t) return;
				const ts = now();
				await db.transactions.update(id, { ...patch, updatedAt: ts });
				// Valor e data de uma transferência são espelhados na outra perna.
				const partner = t.kind === 'transfer' ? await partnerOf(t) : undefined;
				if (partner) {
					const mirror: Partial<Transaction> = { updatedAt: ts };
					if (patch.amountCents !== undefined) mirror.amountCents = -patch.amountCents;
					if (patch.date !== undefined) mirror.date = patch.date;
					await db.transactions.update(partner.id, mirror);
				}
			});
			notifyChange();
		},

		async remove(id) {
			await db.transaction('rw', db.transactions, async () => {
				const t = await db.transactions.get(id);
				if (!t) return;
				const ts = now();
				await db.transactions.update(id, { deletedAt: ts, updatedAt: ts });
				const partner = await partnerOf(t);
				if (partner) await db.transactions.update(partner.id, { deletedAt: ts, updatedAt: ts });
			});
			notifyChange();
		},

		async createTransfer(data: NewTransfer) {
			const transferId = uuid();
			const common = {
				date: data.date,
				description: data.description,
				notes: data.notes,
				kind: 'transfer' as const,
				categoryId: null,
				transferId,
				fitId: null,
				importBatchId: null,
				recurringId: null
			};
			await db.transactions.bulkAdd([
				stamp<Transaction>({
					...common,
					accountId: data.fromAccountId,
					amountCents: -Math.abs(data.amountCents)
				}),
				stamp<Transaction>({
					...common,
					accountId: data.toAccountId,
					amountCents: Math.abs(data.amountCents)
				})
			]);
			notifyChange();
			return transferId;
		},

		async convertToTransfer(id, counterpartAccountId) {
			await db.transaction('rw', db.transactions, async () => {
				const t = await db.transactions.get(id);
				if (!t || t.accountId === counterpartAccountId) return;
				const ts = now();
				const candidates = await db.transactions
					.where('[accountId+date]')
					.between(
						[counterpartAccountId, addDays(t.date, -TRANSFER_MATCH_DAYS)],
						[counterpartAccountId, addDays(t.date, TRANSFER_MATCH_DAYS)],
						true,
						true
					)
					.toArray();
				const match = candidates
					.filter((c) => isLive(c) && c.amountCents === -t.amountCents && c.kind !== 'transfer')
					.sort(
						(a, b) => Math.abs(daysBetween(a.date, t.date)) - Math.abs(daysBetween(b.date, t.date))
					)[0];

				const transferId = t.transferId ?? uuid();
				await db.transactions.update(id, {
					kind: 'transfer',
					categoryId: null,
					transferId,
					updatedAt: ts
				});
				if (match) {
					await db.transactions.update(match.id, {
						kind: 'transfer',
						categoryId: null,
						transferId,
						updatedAt: ts
					});
				} else {
					await db.transactions.add(
						stamp<Transaction>({
							accountId: counterpartAccountId,
							date: t.date,
							amountCents: -t.amountCents,
							description: t.description,
							notes: '',
							kind: 'transfer',
							categoryId: null,
							transferId,
							fitId: null,
							importBatchId: null,
							recurringId: null
						})
					);
				}
			});
			notifyChange();
		},

		async unlinkTransfer(id) {
			await db.transaction('rw', db.transactions, async () => {
				const t = await db.transactions.get(id);
				if (!t?.transferId) return;
				const legs = await db.transactions.where('transferId').equals(t.transferId).toArray();
				const ts = now();
				for (const leg of legs) {
					await db.transactions.update(leg.id, {
						kind: leg.amountCents < 0 ? 'expense' : 'income',
						transferId: null,
						updatedAt: ts
					});
				}
			});
			notifyChange();
		},

		async restore(id) {
			await db.transaction('rw', db.transactions, async () => {
				const t = await db.transactions.get(id);
				if (!t?.deletedAt) return;
				const legs = t.transferId
					? (await db.transactions.where('transferId').equals(t.transferId).toArray()).filter(
							(l) => l.deletedAt === t.deletedAt
						)
					: [t];
				const ts = now();
				for (const leg of legs)
					await db.transactions.update(leg.id, { deletedAt: null, updatedAt: ts });
			});
			notifyChange();
		},

		async setCategory(ids, categoryId) {
			const ts = now();
			await db.transactions.bulkUpdate(
				ids.map((key) => ({ key, changes: { categoryId, updatedAt: ts } }))
			);
			notifyChange();
		}
	};

	const store: DataStore = {
		accountTypes: crudRepository(db.accountTypes),
		accounts: crudRepository(db.accounts),
		categories: crudRepository(db.categories),
		rules: crudRepository(db.rules),
		transactions,

		recurring: {
			...crudRepository(db.recurring),
			async materialize(upTo) {
				let created = 0;
				await db.transaction('rw', db.recurring, db.transactions, async () => {
					const rules = (await db.recurring.toArray()).filter(isLive);
					for (const rule of rules) {
						const { dates, nextDate } = dueOccurrences(rule, upTo);
						if (dates.length === 0) continue;
						// Id estável por regra+data: outro aparelho que lançar a mesma ocorrência
						// gera o mesmo registro, e a sincronização não duplica.
						const occurrences = dates.map((date) => recurringTransaction(rule, date));
						const existing = await db.transactions.bulkGet(occurrences.map((o) => o.id));
						const fresh = occurrences.filter((_, i) => !existing[i]);
						if (fresh.length) await db.transactions.bulkAdd(fresh);
						await db.recurring.update(rule.id, { nextDate, updatedAt: now() });
						created += fresh.length;
					}
				});
				if (created) notifyChange();
				return created;
			}
		},

		imports: {
			async list() {
				return (await db.importBatches.toArray())
					.filter(isLive)
					.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
			},

			async commit(req: ImportRequest) {
				const included = req.items.filter((i) => i.include);
				const batch = stamp<ImportBatch>({
					accountId: req.accountId,
					fileName: req.fileName,
					importedCount: included.length,
					skippedCount: req.items.length - included.length,
					periodStart: req.statement.start,
					periodEnd: req.statement.end
				});

				await db.transaction('rw', db.transactions, db.importBatches, db.accounts, async () => {
					await db.importBatches.add(batch);
					const ts = now();
					for (const item of included) {
						let transferId: ID | null = null;
						if (item.kind === 'transfer') {
							const pair = item.pairWithId ? await db.transactions.get(item.pairWithId) : undefined;
							transferId = pair?.transferId ?? uuid();
							if (pair) {
								await db.transactions.update(pair.id, {
									kind: 'transfer',
									categoryId: null,
									transferId,
									updatedAt: ts
								});
							}
						}
						await db.transactions.add(
							stamp<Transaction>({
								accountId: req.accountId,
								date: item.source.date,
								amountCents: item.source.amountCents,
								description: item.description,
								notes: '',
								kind: item.kind,
								categoryId: item.kind === 'transfer' ? null : item.categoryId,
								transferId,
								fitId: item.source.fitId,
								importBatchId: batch.id,
								recurringId: null
							})
						);
					}
					// Guarda a identificação do OFX na conta para casar as próximas importações sozinho.
					const account = await db.accounts.get(req.accountId);
					if (account && !account.ofxAccountId && req.statement.accountId) {
						await db.accounts.update(account.id, {
							ofxAccountId: req.statement.accountId,
							ofxBankId: req.statement.bankId,
							updatedAt: ts
						});
					}
				});
				notifyChange();
				return batch;
			},

			async undo(batchId) {
				let removed = 0;
				await db.transaction('rw', db.transactions, db.importBatches, async () => {
					const ts = now();
					const rows = await db.transactions.where('importBatchId').equals(batchId).toArray();
					for (const t of rows.filter(isLive)) {
						await db.transactions.update(t.id, { deletedAt: ts, updatedAt: ts });
						removed++;
					}
					await db.importBatches.update(batchId, { deletedAt: ts, updatedAt: ts });
				});
				notifyChange();
				return removed;
			}
		},

		async ensureSeed() {
			let changed = false;
			await db.transaction('rw', [db.meta, db.accountTypes, db.categories, db.rules], async () => {
				const seeded = await db.meta.get('seeded');
				const version = Number((await db.meta.get('seedVersion'))?.value ?? (seeded ? 1 : 0));
				if (version >= SEED_VERSION) return;
				changed = true;

				if (!seeded) {
					await db.accountTypes.bulkAdd(
						SEED_ACCOUNT_TYPES.map((t) => stamp<AccountType>({ ...t, isSystem: true }))
					);
				}

				// Acrescenta só o que falta, comparando também com o que foi excluído:
				// uma categoria ou regra que o usuário apagou não volta numa atualização.
				const existingCats = await db.categories.toArray();
				const namesTaken = new Set(existingCats.map((c) => c.name));
				const newCats = SEED_CATEGORIES.filter((c) => !namesTaken.has(c.name)).map((c) =>
					stamp<Category>({ ...c, isSystem: true })
				);
				await db.categories.bulkAdd(newCats);
				const idByName = new Map(
					[...existingCats.filter((c) => !c.deletedAt), ...newCats].map((c) => [c.name, c.id])
				);

				const existingRules = await db.rules.toArray();
				const catName = new Map(existingCats.map((c) => [c.id, c.name]));
				const ruleKeys = new Set(
					existingRules.map((r) => `${r.pattern}|${catName.get(r.categoryId) ?? r.categoryId}`)
				);
				const newRules = SEED_RULES.filter(
					(r) => idByName.has(r.category) && !ruleKeys.has(`${r.pattern}|${r.category}`)
				).map((r) =>
					stamp<CategorizationRule>({
						pattern: r.pattern,
						matchType: r.matchType,
						categoryId: idByName.get(r.category)!,
						accountId: null,
						priority: 0,
						isSystem: true
					})
				);
				await db.rules.bulkAdd(newRules);

				if (!seeded) await db.meta.put({ key: 'seeded', value: now() });
				await db.meta.put({ key: 'seedVersion', value: SEED_VERSION });
			});
			if (changed) notifyChange();
		},

		async exportBackup(): Promise<Backup> {
			const tables: Record<string, unknown[]> = {};
			for (const name of TABLES) tables[name] = await db.table(name).toArray();
			return { app: 'vida-boa', version: BACKUP_VERSION, exportedAt: now(), tables };
		},

		async restoreBackup(backup) {
			if (backup?.app !== 'vida-boa' || typeof backup.tables !== 'object') {
				throw new Error('Arquivo de backup inválido.');
			}
			await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.meta], async () => {
				for (const name of TABLES) {
					await db.table(name).clear();
					const rows = backup.tables[name];
					if (Array.isArray(rows)) await db.table(name).bulkAdd(rows);
				}
				await db.meta.put({ key: 'seeded', value: now() });
			});
			notifyChange();
		},

		async wipe() {
			await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.meta], async () => {
				for (const name of TABLES) await db.table(name).clear();
				await db.meta.clear();
			});
			await store.ensureSeed();
		}
	};

	return store;
}

function recurringTransaction(rule: RecurringRule, date: string): Transaction {
	return stamp<Transaction>({
		id: stableUuid(`recurring:${rule.id}:${date}`),
		accountId: rule.accountId,
		date,
		amountCents: rule.kind === 'expense' ? -Math.abs(rule.amountCents) : Math.abs(rule.amountCents),
		description: rule.description,
		notes: '',
		kind: rule.kind,
		categoryId: rule.categoryId,
		transferId: null,
		fitId: null,
		importBatchId: null,
		recurringId: rule.id
	});
}

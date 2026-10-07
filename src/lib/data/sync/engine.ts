import type { Table } from 'dexie';
import type {
	Account,
	CategorizationRule,
	Entity,
	RecurringRule,
	Transaction
} from '../../domain/types';
import { notifyChange } from '../changes';
import { TABLES, type VidaBoaDB } from '../dexie/db';
import { fromRemote, SYNC_TABLES, toRemote, type LocalTable } from './mapping';

/**
 * Sincronização local-first. O aparelho é a fonte de leitura e escrita; a nuvem é a réplica
 * compartilhada entre aparelhos.
 *
 * - Subir: tudo o que mudou localmente desde a última subida (por updatedAt, relógio do aparelho).
 * - Baixar: tudo o que chegou na nuvem desde o último cursor (server_updated_at, relógio do servidor).
 * - Conflito: vence o updatedAt mais recente, dos dois lados (o gatilho no Postgres faz o mesmo).
 * Exclusões são lógicas (deletedAt), então sincronizam como qualquer alteração.
 */

export interface RemoteAdapter {
	push(table: string, rows: Record<string, unknown>[]): Promise<void>;
	/** Linhas com server_updated_at >= `since`, em ordem crescente. */
	pull(table: string, since: string | null, limit: number): Promise<Record<string, unknown>[]>;
	/** Se a conta já tem algum dado na nuvem. */
	hasData(): Promise<boolean>;
}

const PAGE = 1000;
const PUSH_BATCH = 500;

const key = (userId: string, kind: 'push' | 'pull', table: string) =>
	`sync:${userId}:${kind}:${table}`;

async function getMeta(db: VidaBoaDB, k: string): Promise<string | null> {
	return ((await db.meta.get(k))?.value as string | undefined) ?? null;
}

function table(db: VidaBoaDB, name: LocalTable): Table<Entity, string> {
	return db.table(name);
}

export async function pushChanges(db: VidaBoaDB, remote: RemoteAdapter, userId: string) {
	let pushed = 0;
	for (const t of SYNC_TABLES) {
		const since = await getMeta(db, key(userId, 'push', t.local));
		// Marca o início antes de ler: o que mudar durante a subida vai na próxima.
		const startedAt = new Date().toISOString();
		const rows = await table(db, t.local)
			.filter((r) => !since || r.updatedAt > since)
			.toArray();
		for (let i = 0; i < rows.length; i += PUSH_BATCH) {
			const batch = rows.slice(i, i + PUSH_BATCH).map((r) => toRemote(t.local, { ...r }, userId));
			await remote.push(t.remote, batch);
		}
		pushed += rows.length;
		await db.meta.put({ key: key(userId, 'push', t.local), value: startedAt });
	}
	return pushed;
}

export async function pullChanges(db: VidaBoaDB, remote: RemoteAdapter, userId: string) {
	let applied = 0;
	for (const t of SYNC_TABLES) {
		let cursor = await getMeta(db, key(userId, 'pull', t.local));
		for (;;) {
			const page = await remote.pull(t.remote, cursor, PAGE);
			if (page.length === 0) break;
			const incoming = page.map((r) => fromRemote(t.local, r));
			await db.transaction('rw', table(db, t.local), async () => {
				const tbl = table(db, t.local);
				const current = await tbl.bulkGet(incoming.map((i) => i.row.id as string));
				const newer = incoming
					.filter(
						(i, idx) => !current[idx] || (i.row.updatedAt as string) > current[idx]!.updatedAt
					)
					.map((i) => i.row as unknown as Entity);
				if (newer.length) await tbl.bulkPut(newer);
				applied += newer.length;
			});
			const last = incoming[incoming.length - 1].serverUpdatedAt;
			// O cursor é inclusivo (>=); se uma página cheia terminar no mesmo instante, avança mesmo assim.
			if (last === cursor && page.length === PAGE) break;
			cursor = last;
			await db.meta.put({ key: key(userId, 'pull', t.local), value: cursor });
			if (page.length < PAGE) break;
		}
	}
	if (applied) notifyChange('remote');
	return applied;
}

export async function syncOnce(db: VidaBoaDB, remote: RemoteAdapter, userId: string) {
	let pushed = await pushChanges(db, remote, userId);
	const pulled = await pullChanges(db, remote, userId);
	if (await mergeSeedDuplicates(db)) pushed += await pushChanges(db, remote, userId);
	return { pushed, pulled };
}

/** Escolha estável: todo aparelho elege a mesma cópia, então as junções convergem. */
const oldestFirst = (a: Entity, b: Entity) =>
	a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Agrupa as linhas vivas por `keyOf`; devolve, para cada cópia sobrando, o id da que fica. */
function duplicatesOf<T extends Entity>(rows: T[], keyOf: (r: T) => string): Map<string, string> {
	const groups = new Map<string, T[]>();
	for (const r of rows.filter((r) => !r.deletedAt)) {
		const k = keyOf(r);
		groups.set(k, [...(groups.get(k) ?? []), r]);
	}
	const keepOf = new Map<string, string>();
	for (const group of groups.values()) {
		const [keep, ...rest] = group.sort(oldestFirst);
		for (const r of rest) keepOf.set(r.id, keep.id);
	}
	return keepOf;
}

/**
 * Junta as cópias dos dados iniciais (tipos de conta, categorias e regras) que aparelhos
 * diferentes criaram com ids próprios e subiram para a mesma conta. Fica a mais antiga; as
 * referências passam para ela e as outras são excluídas (logicamente, para sincronizar).
 * Só mexe em registros do sistema: o que o usuário criou com o mesmo nome continua separado.
 */
export async function mergeSeedDuplicates(db: VidaBoaDB): Promise<number> {
	const tables = [
		db.accountTypes,
		db.accounts,
		db.categories,
		db.rules,
		db.transactions,
		db.recurring,
		db.loans
	];
	const merged = await db.transaction('rw', tables, async () => {
		const ts = new Date().toISOString();
		let count = 0;
		const retire = async (tbl: Table<Entity, string>, ids: Iterable<string>) => {
			for (const id of ids) {
				await tbl.update(id, { deletedAt: ts, updatedAt: ts });
				count++;
			}
		};
		const repoint = async <T extends Entity>(
			tbl: Table<T, string>,
			field: keyof T & string,
			keepOf: Map<string, string>
		) => {
			if (!keepOf.size) return;
			const rows = await tbl
				.where(field)
				.anyOf([...keepOf.keys()])
				.toArray();
			for (const r of rows) {
				const to = keepOf.get(r[field] as string)!;
				await tbl.update(r.id, { [field]: to, updatedAt: ts } as never);
			}
		};
		const repointAll = async <T extends Entity>(
			tbl: Table<T, string>,
			field: keyof T & string,
			keepOf: Map<string, string>
		) => {
			if (!keepOf.size) return;
			for (const r of await tbl.toArray()) {
				const to = keepOf.get(r[field] as string);
				if (to) await tbl.update(r.id, { [field]: to, updatedAt: ts } as never);
			}
		};

		const types = (await db.accountTypes.toArray()).filter((t) => t.isSystem);
		const typeKeep = duplicatesOf(types, (t) => `${t.kind}|${t.name}`);
		await repoint(db.accounts as Table<Account, string>, 'typeId', typeKeep);
		await retire(db.accountTypes as Table<Entity, string>, typeKeep.keys());

		const cats = (await db.categories.toArray()).filter((c) => c.isSystem);
		const catKeep = duplicatesOf(cats, (c) => `${c.kind}|${c.name}`);
		await repoint(db.rules as Table<CategorizationRule, string>, 'categoryId', catKeep);
		// categoryId não é indexado nos lançamentos nem nos recorrentes: percorre a tabela.
		await repointAll(db.transactions as Table<Transaction, string>, 'categoryId', catKeep);
		await repointAll(db.recurring as Table<RecurringRule, string>, 'categoryId', catKeep);
		await retire(db.categories as Table<Entity, string>, catKeep.keys());

		// Depois de apontar para a mesma categoria, as regras iniciais repetidas ficam iguais.
		const rules = (await db.rules.toArray()).filter((r) => r.isSystem);
		const ruleKeep = duplicatesOf(
			rules,
			(r) => `${r.pattern}|${r.matchType}|${r.categoryId}|${r.accountId ?? ''}`
		);
		await retire(db.rules as Table<Entity, string>, ruleKeep.keys());
		return count;
	});
	if (merged) notifyChange();
	return merged;
}

/** Dono dos dados locais: impede misturar contas no mesmo aparelho. */
export async function getOwner(db: VidaBoaDB): Promise<string | null> {
	return getMeta(db, 'sync:owner');
}

/** O aparelho tem dados do usuário (além dos iniciais)? */
export async function hasLocalUserData(db: VidaBoaDB): Promise<boolean> {
	return (await db.accounts.count()) > 0 || (await db.transactions.count()) > 0;
}

/**
 * Prepara o aparelho para uma conta, na primeira sincronização:
 * - aparelho sem dados e conta com dados: limpa o local e baixa tudo (evita duplicar
 *   as categorias iniciais, que cada aparelho cria com ids próprios);
 * - caso contrário: mantém o local, que sobe na sincronização.
 */
export async function adoptAccount(db: VidaBoaDB, remote: RemoteAdapter, userId: string) {
	const owner = await getOwner(db);
	if (owner === userId) return;
	if (!(await hasLocalUserData(db)) && (await remote.hasData())) {
		await clearLocal(db);
	}
	await db.meta.put({ key: 'sync:owner', value: userId });
}

/**
 * Recria os dados iniciais só quando a conta é nova de verdade: aparelho sem categorias e nuvem
 * vazia. Se a nuvem já tem dados (aparelho recém-adotado), eles chegam no pull; recriar aqui
 * subiria uma segunda cópia das categorias, tipos e regras, com ids diferentes.
 */
export async function seedIfNewAccount(
	db: VidaBoaDB,
	remote: RemoteAdapter,
	seed: () => Promise<void>
): Promise<boolean> {
	if ((await db.categories.count()) > 0) return false;
	if (await remote.hasData()) return false;
	await db.meta.bulkDelete(['seeded', 'seedVersion']);
	await seed();
	return true;
}

/** Apaga os dados locais e o estado de sincronização, mantendo os iniciais como "já criados". */
export async function clearLocal(db: VidaBoaDB) {
	await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.meta], async () => {
		for (const name of TABLES) await db.table(name).clear();
		const meta = await db.meta.toArray();
		for (const m of meta)
			if (m.key !== 'seeded' && m.key !== 'seedVersion') await db.meta.delete(m.key);
	});
	notifyChange('remote');
}

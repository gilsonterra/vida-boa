import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Account } from '../../domain/types';
import { buildImportPlan } from '../../import/plan';
import type { OfxStatement } from '../../ofx/parse';
import type { DataStore } from '../repositories';
import { VidaBoaDB } from './db';
import { createDexieStore } from './store';

let store: DataStore;
let checking: Account;
let card: Account;

beforeEach(async () => {
	store = createDexieStore(new VidaBoaDB(`test-${crypto.randomUUID()}`));
	await store.ensureSeed();
	const types = await store.accountTypes.list();
	const typeId = (kind: string) => types.find((t) => t.kind === kind)!.id;
	const account = (name: string, kind: string) =>
		store.accounts.create({
			name,
			typeId: typeId(kind),
			institution: '',
			color: '#2f5d46',
			initialBalanceCents: 0,
			currency: 'BRL',
			archived: false,
			ofxBankId: null,
			ofxAccountId: null
		});
	checking = await account('Itaú', 'checking');
	card = await account('Black', 'credit_card');
});

function statement(transactions: OfxStatement['transactions']): OfxStatement {
	return {
		kind: 'bank',
		currency: 'BRL',
		bankId: '0341',
		accountId: '12345-6',
		accountType: 'CHECKING',
		start: '2026-10-01',
		end: '2026-10-31',
		ledgerBalanceCents: null,
		ledgerDate: null,
		transactions
	};
}

async function importInto(account: Account, stmt: OfxStatement) {
	const [existing, all, rules, categories, types, accounts] = await Promise.all([
		store.transactions.listByAccount(account.id, { includeDeleted: true }),
		store.transactions.list(),
		store.rules.list(),
		store.categories.list(),
		store.accountTypes.list(),
		store.accounts.list()
	]);
	const kindOf = (a: Account) => types.find((t) => t.id === a.typeId)!.kind;
	const items = buildImportPlan(stmt.transactions, {
		accountId: account.id,
		accountKind: kindOf(account),
		existing,
		others: all.filter((t) => t.accountId !== account.id),
		accountKinds: new Map(accounts.map((a) => [a.id, kindOf(a)])),
		history: all,
		rules,
		categories
	});
	await store.imports.commit({ accountId: account.id, fileName: 'x.ofx', statement: stmt, items });
	return items;
}

describe('seed', () => {
	it('cria categorias e regras uma única vez', async () => {
		const before = (await store.categories.list()).length;
		await store.ensureSeed();
		expect((await store.categories.list()).length).toBe(before);
		expect(before).toBeGreaterThan(20);
		expect((await store.rules.list()).length).toBeGreaterThan(50);
	});
});

describe('atualização dos dados iniciais', () => {
	it('acrescenta categorias e regras novas sem duplicar nem ressuscitar excluídas', async () => {
		const name = `test-${crypto.randomUUID()}`;
		const db = new VidaBoaDB(name);
		const s1 = createDexieStore(db);
		await s1.ensureSeed();
		// Simula uma instalação da versão 1: sem Financiamentos, sem regras novas, sem seedVersion.
		const fin = (await s1.categories.list()).find((c) => c.name === 'Financiamentos')!;
		await db.rules.where('categoryId').equals(fin.id).delete();
		await db.categories.delete(fin.id);
		await db.rules.filter((r) => r.pattern === 'ESPETINHO').delete();
		await db.meta.delete('seedVersion');
		// O usuário excluiu uma categoria antiga: ela não deve voltar.
		const pets = (await s1.categories.list()).find((c) => c.name === 'Pets')!;
		await s1.categories.remove(pets.id);
		const rulesBefore = (await s1.rules.list()).length;

		await s1.ensureSeed();
		const cats = await s1.categories.list();
		expect(cats.filter((c) => c.name === 'Financiamentos')).toHaveLength(1);
		expect(cats.some((c) => c.name === 'Pets')).toBe(false);
		const rules = await s1.rules.list();
		expect(rules.filter((r) => r.pattern === 'ESPETINHO')).toHaveLength(1);
		expect(rules.length).toBeGreaterThan(rulesBefore);

		// Rodar de novo não muda nada.
		await s1.ensureSeed();
		expect((await s1.rules.list()).length).toBe(rules.length);
	});
});

describe('importação', () => {
	const stmt = statement([
		{
			fitId: 'A1',
			date: '2026-10-02',
			amountCents: -3500,
			type: 'DEBIT',
			description: 'UBER *TRIP',
			checkNum: null
		},
		{
			fitId: 'A2',
			date: '2026-10-05',
			amountCents: 1500000,
			type: 'CREDIT',
			description: 'SALARIO',
			checkNum: null
		}
	]);

	it('grava, categoriza, guarda o ACCTID e não duplica ao reimportar', async () => {
		await importInto(checking, stmt);
		const txs = await store.transactions.listByAccount(checking.id);
		expect(txs).toHaveLength(2);
		expect(txs.every((t) => t.categoryId)).toBe(true);
		expect((await store.accounts.get(checking.id))!.ofxAccountId).toBe('12345-6');

		const again = await importInto(checking, stmt);
		expect(again.every((i) => i.status === 'duplicate')).toBe(true);
		expect(await store.transactions.listByAccount(checking.id)).toHaveLength(2);
	});

	it('desfaz uma importação inteira', async () => {
		await importInto(checking, stmt);
		const [batch] = await store.imports.list();
		expect(await store.imports.undo(batch.id)).toBe(2);
		expect(await store.transactions.listByAccount(checking.id)).toHaveLength(0);
		expect(await store.imports.list()).toHaveLength(0);
	});

	it('pareia pagamento de fatura importado depois no cartão', async () => {
		await importInto(
			checking,
			statement([
				{
					fitId: 'P1',
					date: '2026-10-10',
					amountCents: -500000,
					type: 'DEBIT',
					description: 'PAG FATURA CARTAO',
					checkNum: null
				}
			])
		);
		await importInto(card, {
			...statement([
				{
					fitId: 'C1',
					date: '2026-10-11',
					amountCents: 500000,
					type: 'CREDIT',
					description: 'Pagamento recebido',
					checkNum: null
				}
			]),
			kind: 'credit_card',
			accountId: '5555'
		});

		const legs = (await store.transactions.list()).filter((t) => t.kind === 'transfer');
		expect(legs).toHaveLength(2);
		expect(legs[0].transferId).toBe(legs[1].transferId);
	});
});

describe('transferências', () => {
	it('cria duas pernas e espelha edição e exclusão', async () => {
		await store.transactions.createTransfer({
			fromAccountId: checking.id,
			toAccountId: card.id,
			amountCents: 10000,
			date: '2026-10-01',
			description: 'Pagamento fatura',
			notes: ''
		});
		const [out] = await store.transactions.listByAccount(checking.id);
		await store.transactions.update(out.id, { amountCents: -12000, date: '2026-10-02' });
		const [into] = await store.transactions.listByAccount(card.id);
		expect(into).toMatchObject({ amountCents: 12000, date: '2026-10-02', kind: 'transfer' });

		await store.transactions.remove(into.id);
		expect(await store.transactions.list()).toHaveLength(0);
	});

	it('converte um lançamento em transferência pareando com a perna existente', async () => {
		const base = {
			description: 'PIX',
			notes: '',
			categoryId: null,
			transferId: null,
			fitId: null,
			importBatchId: null,
			recurringId: null
		};
		const a = await store.transactions.create({
			...base,
			accountId: checking.id,
			date: '2026-10-01',
			amountCents: -5000,
			kind: 'expense'
		});
		await store.transactions.create({
			...base,
			accountId: card.id,
			date: '2026-10-03',
			amountCents: 5000,
			kind: 'income'
		});
		await store.transactions.convertToTransfer(a.id, card.id);
		const all = await store.transactions.list();
		expect(all).toHaveLength(2);
		expect(new Set(all.map((t) => t.transferId)).size).toBe(1);

		await store.transactions.unlinkTransfer(a.id);
		expect((await store.transactions.list()).map((t) => t.kind).sort()).toEqual([
			'expense',
			'income'
		]);
	});
});

describe('recorrentes', () => {
	it('lança as ocorrências vencidas uma única vez', async () => {
		await store.recurring.create({
			description: 'Aluguel',
			accountId: checking.id,
			categoryId: null,
			kind: 'expense',
			amountCents: 800000,
			frequency: 'monthly',
			startDate: '2026-08-05',
			endDate: null,
			nextDate: '2026-08-05',
			active: true
		});
		expect(await store.recurring.materialize('2026-10-06')).toBe(3);
		expect(await store.recurring.materialize('2026-10-06')).toBe(0);
		const txs = await store.transactions.list();
		expect(txs.map((t) => [t.date, t.amountCents])).toEqual([
			['2026-10-05', -800000],
			['2026-09-05', -800000],
			['2026-08-05', -800000]
		]);
	});
});

describe('backup', () => {
	it('exporta e restaura tudo', async () => {
		await store.transactions.createTransfer({
			fromAccountId: checking.id,
			toAccountId: card.id,
			amountCents: 1,
			date: '2026-10-01',
			description: 'x',
			notes: ''
		});
		const backup = JSON.parse(JSON.stringify(await store.exportBackup()));
		await store.wipe();
		expect(await store.accounts.list()).toHaveLength(0);
		await store.restoreBackup(backup);
		expect(await store.accounts.list()).toHaveLength(2);
		expect(await store.transactions.list()).toHaveLength(2);
	});
});

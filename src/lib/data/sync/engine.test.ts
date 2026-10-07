import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../domain/types';
import { VidaBoaDB } from '../dexie/db';
import { createDexieStore } from '../dexie/store';
import { adoptAccount, seedIfNewAccount, syncOnce, type RemoteAdapter } from './engine';

/**
 * Nuvem em memória com as mesmas regras do Postgres: chave (user_id, id), vence o
 * updated_at mais recente e cada gravação aceita ganha um server_updated_at crescente.
 */
class FakeCloud {
	tables = new Map<string, Map<string, Record<string, unknown>>>();
	clock = 0;

	adapter(): RemoteAdapter {
		return {
			push: async (table, rows) => {
				const t = this.tables.get(table) ?? new Map();
				this.tables.set(table, t);
				for (const row of rows) {
					const k = `${row.user_id}|${row.id}`;
					const old = t.get(k);
					if (old && (row.updated_at as string) <= (old.updated_at as string)) continue;
					const stamp = new Date(Date.UTC(2026, 0, 1) + ++this.clock)
						.toISOString()
						.replace('Z', '+00:00');
					t.set(k, { ...row, server_updated_at: stamp });
				}
			},
			pull: async (table, since, limit) =>
				[...(this.tables.get(table)?.values() ?? [])]
					.filter((r) => !since || (r.server_updated_at as string) >= since)
					.sort((a, b) =>
						(a.server_updated_at as string).localeCompare(b.server_updated_at as string)
					)
					.slice(0, limit),
			hasData: async () => [...this.tables.values()].some((t) => t.size > 0)
		};
	}
}

const USER = 'user-1';

async function device() {
	const db = new VidaBoaDB(`dev-${crypto.randomUUID()}`);
	const store = createDexieStore(db);
	await store.ensureSeed();
	return { db, store };
}

const base = {
	notes: '',
	categoryId: null,
	transferId: null,
	fitId: null,
	importBatchId: null,
	recurringId: null
};

async function newAccount(store: Awaited<ReturnType<typeof device>>['store']) {
	const [type] = await store.accountTypes.list();
	return store.accounts.create({
		name: 'Conta',
		typeId: type.id,
		institution: '',
		color: '#000',
		initialBalanceCents: 0,
		currency: 'BRL',
		archived: false,
		ofxBankId: null,
		ofxAccountId: null
	});
}

const wait = () => new Promise((r) => setTimeout(r, 5));

describe('sincronização', () => {
	it('leva os dados de um aparelho para outro e de volta', async () => {
		const cloud = new FakeCloud();
		const remote = cloud.adapter();
		const a = await device();
		const acc = await newAccount(a.store);
		const tx = await a.store.transactions.create({
			...base,
			accountId: acc.id,
			date: '2026-10-01',
			amountCents: -1000,
			description: 'Café',
			kind: 'expense'
		});
		await adoptAccount(a.db, remote, USER);
		await syncOnce(a.db, remote, USER);

		// Aparelho novo, sem dados: adota a conta e baixa tudo, sem duplicar categorias.
		const b = await device();
		await adoptAccount(b.db, remote, USER);
		await syncOnce(b.db, remote, USER);
		expect((await b.store.transactions.list()).map((t) => t.description)).toEqual(['Café']);
		expect((await b.store.categories.list()).length).toBe((await a.store.categories.list()).length);

		// Edição em B volta para A.
		await wait();
		await b.store.transactions.update(tx.id, { description: 'Café da manhã' });
		await syncOnce(b.db, remote, USER);
		await syncOnce(a.db, remote, USER);
		expect((await a.store.transactions.get(tx.id))!.description).toBe('Café da manhã');

		// Exclusão também sincroniza.
		await wait();
		await a.store.transactions.remove(tx.id);
		await syncOnce(a.db, remote, USER);
		await syncOnce(b.db, remote, USER);
		expect(await b.store.transactions.list()).toHaveLength(0);
	});

	it('aparelho novo numa conta existente não duplica os dados iniciais', async () => {
		const cloud = new FakeCloud();
		const remote = cloud.adapter();
		const a = await device();
		await adoptAccount(a.db, remote, USER);
		expect(await seedIfNewAccount(a.db, remote, () => a.store.ensureSeed())).toBe(false);
		await syncOnce(a.db, remote, USER);

		// Mesmo fluxo do login: adota (limpa o local), decide se semeia e sincroniza.
		const b = await device();
		await adoptAccount(b.db, remote, USER);
		expect(await seedIfNewAccount(b.db, remote, () => b.store.ensureSeed())).toBe(false);
		await syncOnce(b.db, remote, USER);
		await syncOnce(a.db, remote, USER);

		const count = (await a.store.categories.list()).length;
		expect((await b.store.categories.list()).length).toBe(count);
		expect((await a.store.categories.list()).length).toBe(count);
		expect((await b.store.accountTypes.list()).length).toBe(
			(await a.store.accountTypes.list()).length
		);
	});

	it('conta nova num aparelho limpo recebe os dados iniciais', async () => {
		const remote = new FakeCloud().adapter();
		const db = new VidaBoaDB(`dev-${crypto.randomUUID()}`);
		const store = createDexieStore(db);
		expect(await seedIfNewAccount(db, remote, () => store.ensureSeed())).toBe(true);
		expect((await store.categories.list()).length).toBeGreaterThan(0);
	});

	it('em conflito, vence a edição mais recente', async () => {
		const cloud = new FakeCloud();
		const remote = cloud.adapter();
		const a = await device();
		const acc = await newAccount(a.store);
		const tx = await a.store.transactions.create({
			...base,
			accountId: acc.id,
			date: '2026-10-01',
			amountCents: -500,
			description: 'Original',
			kind: 'expense'
		});
		await adoptAccount(a.db, remote, USER);
		await syncOnce(a.db, remote, USER);
		const b = await device();
		await adoptAccount(b.db, remote, USER);
		await syncOnce(b.db, remote, USER);

		// Os dois editam offline; B edita por último.
		await a.store.transactions.update(tx.id, { description: 'Editado em A' });
		await wait();
		await b.store.transactions.update(tx.id, { description: 'Editado em B' });

		// A sincroniza depois, mas a edição de B é mais recente e prevalece nos dois.
		await syncOnce(b.db, remote, USER);
		await syncOnce(a.db, remote, USER);
		await syncOnce(b.db, remote, USER);
		const final = (t: Transaction | undefined) => t!.description;
		expect(final(await a.store.transactions.get(tx.id))).toBe('Editado em B');
		expect(final(await b.store.transactions.get(tx.id))).toBe('Editado em B');
	});

	it('dois aparelhos lançando o mesmo recorrente não duplicam', async () => {
		const cloud = new FakeCloud();
		const remote = cloud.adapter();
		const a = await device();
		const acc = await newAccount(a.store);
		await a.store.recurring.create({
			description: 'Aluguel',
			accountId: acc.id,
			categoryId: null,
			kind: 'expense',
			amountCents: 100000,
			frequency: 'monthly',
			startDate: '2026-09-05',
			endDate: null,
			nextDate: '2026-09-05',
			active: true
		});
		await adoptAccount(a.db, remote, USER);
		await syncOnce(a.db, remote, USER);
		const b = await device();
		await adoptAccount(b.db, remote, USER);
		await syncOnce(b.db, remote, USER);

		// Os dois aparelhos abrem no mesmo dia, offline, e lançam as ocorrências vencidas.
		await a.store.recurring.materialize('2026-10-06');
		await b.store.recurring.materialize('2026-10-06');
		await syncOnce(a.db, remote, USER);
		await syncOnce(b.db, remote, USER);
		await syncOnce(a.db, remote, USER);
		const dates = (await a.store.transactions.list()).map((t) => t.date).sort();
		expect(dates).toEqual(['2026-09-05', '2026-10-05']);
		expect((await b.store.transactions.list()).length).toBe(2);
	});

	it('aparelho com dados próprios sobe tudo ao entrar numa conta vazia', async () => {
		const cloud = new FakeCloud();
		const remote = cloud.adapter();
		const a = await device();
		await newAccount(a.store);
		await adoptAccount(a.db, remote, USER);
		const { pushed } = await syncOnce(a.db, remote, USER);
		expect(pushed).toBeGreaterThan(100);
		expect(cloud.tables.get('accounts')?.size).toBe(1);
	});
});

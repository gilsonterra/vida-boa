import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { stableUuid } from '../../domain/ids';
import type { Transaction } from '../../domain/types';
import { VidaBoaDB } from './db';

function tx(over: Partial<Transaction>): Transaction {
	return {
		id: crypto.randomUUID(),
		createdAt: '2026-10-01T00:00:00.000Z',
		updatedAt: '2026-10-01T00:00:00.000Z',
		deletedAt: null,
		accountId: 'acc-1',
		date: '2026-10-05',
		amountCents: -1000,
		description: 'x',
		notes: '',
		kind: 'expense',
		categoryId: null,
		transferId: null,
		fitId: null,
		importBatchId: null,
		recurringId: null,
		consolidated: true,
		...over
	};
}

describe('atualização do banco local', () => {
	it('conserta os ids inválidos das versões antigas do stableUuid', async () => {
		const name = `test-${crypto.randomUUID()}`;
		// Banco na versão 2, com linhas gravadas pela versão antiga.
		const old = new Dexie(name);
		old.version(2).stores({
			transactions:
				'id, accountId, date, [accountId+date], fitId, transferId, importBatchId, recurringId',
			loans: 'id',
			loanPrepayments: 'id, loanId'
		});
		const ok = tx({ description: 'normal' });
		await old.table('transactions').bulkAdd([
			ok,
			tx({ id: '-20b4bcf-c158-8564-9-1c-4fcd1447e84a', description: 'Casa · parcela 3/12' }),
			tx({
				id: '0-1a2b3c-d4e5-8f00-a-2c-0123456789ab',
				recurringId: 'rec-1',
				description: 'Aluguel'
			})
		]);
		old.close();

		const db = new VidaBoaDB(name);
		const rows = await db.transactions.toArray();
		expect(rows.map((r) => r.description).sort()).toEqual(['Aluguel', 'normal']);
		expect(rows.find((r) => r.description === 'Aluguel')!.id).toBe(
			stableUuid('recurring:rec-1:2026-10-05')
		);
		expect(rows.find((r) => r.description === 'normal')!.id).toBe(ok.id);
		db.close();
	});

	it('passa para a regra do consolidado sem mudar o que já contava', async () => {
		const name = `test-${crypto.randomUUID()}`;
		const old = new Dexie(name);
		old.version(3).stores({
			transactions:
				'id, accountId, date, [accountId+date], fitId, transferId, importBatchId, recurringId',
			loans: 'id',
			loanPrepayments: 'id, loanId'
		});
		const { consolidated: _, ...noField } = tx({ date: '2000-01-01', description: 'antigo' });
		await old
			.table('transactions')
			.bulkAdd([
				noField,
				{ ...noField, id: crypto.randomUUID(), date: '2999-01-01', description: 'futuro' },
				tx({ kind: 'transfer', consolidated: false, description: 'transferência' })
			]);
		await old.table('loans').add({
			id: 'loan-1',
			createdAt: '2000-01-01T00:00:00.000Z',
			updatedAt: '2000-01-01T00:00:00.000Z',
			deletedAt: null,
			name: 'Casa',
			paidBefore: 1,
			termMonths: 600,
			firstDueDate: '2000-01-10',
			installmentStatus: { 900: true, 2: false }
		});
		old.close();

		const db = new VidaBoaDB(name);
		const by = new Map((await db.transactions.toArray()).map((t) => [t.description, t]));
		expect(by.get('antigo')!.consolidated).toBe(true);
		expect(by.get('futuro')!.consolidated).toBe(false);
		expect(by.get('transferência')!.consolidated).toBe(true);
		const status = (await db.loans.get('loan-1'))!.installmentStatus!;
		// Vencidas sem marca viram consolidadas; marca à mão é respeitada; antes do app fica de fora.
		expect(status[1]).toBeUndefined();
		expect(status[2]).toBeUndefined();
		expect(status[3]).toBe(true);
		expect(status[900]).toBe(true);
		db.close();
	});
});

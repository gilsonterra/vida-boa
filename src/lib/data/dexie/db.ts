import Dexie, { type EntityTable } from 'dexie';
import { isUuid, stableUuid } from '../../domain/ids';
import { today } from '../../domain/dates';
import { dueDateOf } from '../../domain/loans';
import type {
	Account,
	AccountType,
	CategorizationRule,
	Category,
	ImportBatch,
	Loan,
	LoanPrepayment,
	RecurringRule,
	Transaction
} from '../../domain/types';

export interface MetaRow {
	key: string;
	value: unknown;
}

export class VidaBoaDB extends Dexie {
	accountTypes!: EntityTable<AccountType, 'id'>;
	accounts!: EntityTable<Account, 'id'>;
	categories!: EntityTable<Category, 'id'>;
	rules!: EntityTable<CategorizationRule, 'id'>;
	transactions!: EntityTable<Transaction, 'id'>;
	recurring!: EntityTable<RecurringRule, 'id'>;
	importBatches!: EntityTable<ImportBatch, 'id'>;
	loans!: EntityTable<Loan, 'id'>;
	loanPrepayments!: EntityTable<LoanPrepayment, 'id'>;
	meta!: EntityTable<MetaRow, 'key'>;

	constructor(name = 'vida-boa') {
		super(name);
		// Só campos usados em consultas são indexados; o resto fica no objeto.
		this.version(1).stores({
			accountTypes: 'id',
			accounts: 'id, typeId',
			categories: 'id, kind',
			rules: 'id, categoryId',
			transactions:
				'id, accountId, date, [accountId+date], fitId, transferId, importBatchId, recurringId',
			recurring: 'id',
			importBatches: 'id, accountId',
			meta: 'key'
		});
		this.version(2).stores({ loans: 'id', loanPrepayments: 'id, loanId' });
		// Versões antigas do stableUuid às vezes geravam ids inválidos ("-20b4bcf-…"), que o
		// Postgres recusa e travam a subida. Ocorrências de recorrentes ganham o id certo;
		// as parcelas lançadas pelos financiamentos (que não lançam mais nada) saem.
		this.version(3).upgrade(async (tx) => {
			const table = tx.table<Transaction, string>('transactions');
			const bad = await table.filter((t) => !isUuid(t.id)).toArray();
			const ts = new Date().toISOString();
			for (const t of bad) {
				await table.delete(t.id);
				if (!t.recurringId) continue;
				const id = stableUuid(`recurring:${t.recurringId}:${t.date}`);
				if (!(await table.get(id))) await table.add({ ...t, id, updatedAt: ts });
			}
		});
		// Lançamentos ganham "consolidado": os que já existiam ficam consolidados, menos os de
		// data futura. Só esses sobem de novo; na nuvem a coluna nasce verdadeira.
		this.version(4).upgrade(async (tx) => {
			const table = tx.table<Transaction, string>('transactions');
			const day = today();
			const ts = new Date().toISOString();
			await table.toCollection().modify((t) => {
				if (t.consolidated !== undefined) return;
				t.consolidated = t.date <= day;
				if (!t.consolidated) t.updatedAt = ts;
			});
		});
		// A regra passou a ser só o consolidado, sem olhar a data. Parcelas vencidas contavam
		// como pagas sozinhas: viram consolidadas de verdade, para nada mudar. Transferências
		// são sempre consolidadas.
		this.version(5).upgrade(async (tx) => {
			const day = today();
			const ts = new Date().toISOString();
			await tx
				.table<Loan, string>('loans')
				.toCollection()
				.modify((loan) => {
					const old = loan.installmentStatus ?? {};
					const status: Record<string, boolean> = {};
					// Marcadas à mão como consolidadas continuam; vencidas sem marca passam a ter.
					for (const [n, v] of Object.entries(old)) if (v) status[n] = true;
					for (let n = loan.paidBefore + 1; n <= 600 && dueDateOf(loan, n) <= day; n++) {
						if (old[n] === undefined) status[n] = true;
					}
					loan.installmentStatus = status;
					loan.updatedAt = ts;
				});
			await tx
				.table<Transaction, string>('transactions')
				.toCollection()
				.modify((t) => {
					if (t.kind !== 'transfer' || t.consolidated !== false) return;
					t.consolidated = true;
					t.updatedAt = ts;
				});
		});
	}
}

export const TABLES = [
	'accountTypes',
	'accounts',
	'categories',
	'rules',
	'transactions',
	'recurring',
	'importBatches',
	'loans',
	'loanPrepayments'
] as const;

import Dexie, { type EntityTable } from 'dexie';
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

import type {
	Account,
	AccountType,
	CategorizationRule,
	Category,
	Entity,
	ID,
	ImportBatch,
	ISODate,
	NewEntity,
	RecurringRule,
	Transaction
} from '../domain/types';
import type { ImportItem } from '../import/plan';
import type { OfxStatement } from '../ofx/parse';

/**
 * Contrato da camada de dados. As telas só conhecem estas interfaces;
 * hoje a implementação é Dexie (IndexedDB), amanhã será Supabase.
 * Todas as listagens devolvem apenas registros vivos (sem `deletedAt`), salvo indicação.
 */

export interface Repository<T extends Entity> {
	list(): Promise<T[]>;
	get(id: ID): Promise<T | undefined>;
	create(data: NewEntity<T>): Promise<T>;
	update(id: ID, patch: Partial<NewEntity<T>>): Promise<void>;
	/** Exclusão lógica. */
	remove(id: ID): Promise<void>;
}

export interface NewTransfer {
	fromAccountId: ID;
	toAccountId: ID;
	/** Positivo. */
	amountCents: number;
	date: ISODate;
	description: string;
	notes: string;
}

export interface TransactionRepository extends Repository<Transaction> {
	/** Todos os lançamentos, mais recentes primeiro. */
	list(opts?: { includeDeleted?: boolean }): Promise<Transaction[]>;
	listByAccount(accountId: ID, opts?: { includeDeleted?: boolean }): Promise<Transaction[]>;
	createTransfer(data: NewTransfer): Promise<ID>;
	/**
	 * Transforma um lançamento em transferência com outra conta: pareia com a perna oposta
	 * se ela já existir (mesmo valor invertido, até 5 dias), senão cria a perna.
	 */
	convertToTransfer(id: ID, counterpartAccountId: ID): Promise<void>;
	/** Desfaz a transferência: as duas pernas voltam a ser despesa/receita comuns. */
	unlinkTransfer(id: ID): Promise<void>;
	/** Aplica uma categoria a vários lançamentos de uma vez. */
	setCategory(ids: ID[], categoryId: ID | null): Promise<void>;
	/** Desfaz uma exclusão (incluindo a outra perna de uma transferência). */
	restore(id: ID): Promise<void>;
}

export interface ImportRequest {
	accountId: ID;
	fileName: string;
	statement: OfxStatement;
	items: ImportItem[];
}

export interface ImportRepository {
	list(): Promise<ImportBatch[]>;
	commit(req: ImportRequest): Promise<ImportBatch>;
	/** Remove todos os lançamentos criados por uma importação. */
	undo(batchId: ID): Promise<number>;
}

export interface RecurringRepository extends Repository<RecurringRule> {
	/** Lança as ocorrências vencidas até `upTo`. Devolve quantas foram criadas. */
	materialize(upTo: ISODate): Promise<number>;
}

export interface Backup {
	app: 'vida-boa';
	version: number;
	exportedAt: string;
	tables: Record<string, unknown[]>;
}

export interface DataStore {
	accountTypes: Repository<AccountType>;
	accounts: Repository<Account>;
	categories: Repository<Category>;
	rules: Repository<CategorizationRule>;
	transactions: TransactionRepository;
	recurring: RecurringRepository;
	imports: ImportRepository;
	/** Cria tipos de conta, categorias e regras iniciais no primeiro uso. */
	ensureSeed(): Promise<void>;
	exportBackup(): Promise<Backup>;
	restoreBackup(backup: Backup): Promise<void>;
	wipe(): Promise<void>;
}

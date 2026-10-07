/**
 * Correspondência entre as tabelas locais (Dexie, camelCase) e as do Supabase (snake_case).
 * A ordem importa pouco (não há chaves estrangeiras na nuvem), mas subir tipos e categorias
 * antes dos lançamentos deixa os outros aparelhos consistentes mais cedo.
 */
export const SYNC_TABLES = [
	{ local: 'accountTypes', remote: 'account_types' },
	{ local: 'categories', remote: 'categories' },
	{ local: 'accounts', remote: 'accounts' },
	{ local: 'rules', remote: 'categorization_rules' },
	{ local: 'recurring', remote: 'recurring_rules' },
	{ local: 'importBatches', remote: 'import_batches' },
	{ local: 'loans', remote: 'loans' },
	{ local: 'loanPrepayments', remote: 'loan_prepayments' },
	{ local: 'transactions', remote: 'transactions' }
] as const;

export type LocalTable = (typeof SYNC_TABLES)[number]['local'];

type Row = Record<string, unknown>;

const TIMESTAMPS = new Set(['createdAt', 'updatedAt', 'deletedAt']);

const BASE = ['id', 'createdAt', 'updatedAt', 'deletedAt'];

/**
 * Colunas que existem na nuvem, por tabela. Só elas sobem: um backup adulterado não consegue
 * enviar campos inesperados (nem tentar trocar o dono da linha).
 */
const COLUMNS: Record<LocalTable, string[]> = {
	accountTypes: [...BASE, 'name', 'kind', 'isSystem'],
	categories: [...BASE, 'name', 'kind', 'icon', 'color', 'isSystem'],
	accounts: [
		...BASE,
		'name',
		'typeId',
		'institution',
		'color',
		'initialBalanceCents',
		'currency',
		'archived',
		'ofxBankId',
		'ofxAccountId'
	],
	rules: [...BASE, 'pattern', 'matchType', 'categoryId', 'accountId', 'priority', 'isSystem'],
	recurring: [
		...BASE,
		'description',
		'accountId',
		'categoryId',
		'kind',
		'amountCents',
		'frequency',
		'startDate',
		'endDate',
		'nextDate',
		'active'
	],
	importBatches: [
		...BASE,
		'accountId',
		'fileName',
		'importedCount',
		'skippedCount',
		'periodStart',
		'periodEnd'
	],
	loans: [
		...BASE,
		'name',
		'kind',
		'mode',
		'system',
		'principalCents',
		'ratePercent',
		'ratePeriod',
		'installmentCents',
		'termMonths',
		'firstDueDate',
		'paidBefore'
	],
	loanPrepayments: [...BASE, 'loanId', 'date', 'amountCents', 'effect'],
	transactions: [
		...BASE,
		'accountId',
		'date',
		'amountCents',
		'description',
		'notes',
		'kind',
		'categoryId',
		'transferId',
		'fitId',
		'importBatchId',
		'recurringId'
	]
};

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function toRemote(table: LocalTable, row: Row, userId: string): Row {
	const out: Row = {};
	for (const k of COLUMNS[table]) if (k in row) out[toSnake(k)] = row[k];
	// Por último: nada vindo da linha substitui o dono.
	out.user_id = userId;
	return out;
}

/** Converte a linha da nuvem; devolve também o cursor do servidor. */
export function fromRemote(table: LocalTable, row: Row): { row: Row; serverUpdatedAt: string } {
	const allowed = new Set(COLUMNS[table]);
	const out: Row = {};
	for (const [k, v] of Object.entries(row)) {
		const key = toCamel(k);
		if (!allowed.has(key)) continue;
		// O Postgres devolve "2026-10-07T03:00:00+00:00"; o app compara strings ISO com "Z".
		out[key] = TIMESTAMPS.has(key) && typeof v === 'string' ? new Date(v).toISOString() : v;
	}
	return { row: out, serverUpdatedAt: row.server_updated_at as string };
}

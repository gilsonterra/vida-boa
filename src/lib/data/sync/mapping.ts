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
	{ local: 'transactions', remote: 'transactions' }
] as const;

export type LocalTable = (typeof SYNC_TABLES)[number]['local'];

type Row = Record<string, unknown>;

const TIMESTAMPS = new Set(['createdAt', 'updatedAt', 'deletedAt']);

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function toRemote(row: Row, userId: string): Row {
	const out: Row = { user_id: userId };
	for (const [k, v] of Object.entries(row)) out[toSnake(k)] = v;
	return out;
}

/** Converte a linha da nuvem; devolve também o cursor do servidor. */
export function fromRemote(row: Row): { row: Row; serverUpdatedAt: string } {
	const out: Row = {};
	for (const [k, v] of Object.entries(row)) {
		if (k === 'user_id' || k === 'server_updated_at') continue;
		const key = toCamel(k);
		// O Postgres devolve "2026-10-07T03:00:00+00:00"; o app compara strings ISO com "Z".
		out[key] = TIMESTAMPS.has(key) && typeof v === 'string' ? new Date(v).toISOString() : v;
	}
	return { row: out, serverUpdatedAt: row.server_updated_at as string };
}

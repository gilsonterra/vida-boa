import { createDexieStore } from './dexie/store';
import type { DataStore } from './repositories';

/**
 * Ponto único de acesso aos dados. Para migrar ao Supabase, basta trocar a
 * implementação criada aqui por uma que cumpra o mesmo contrato `DataStore`.
 */
export const store: DataStore = createDexieStore();

export type { DataStore } from './repositories';

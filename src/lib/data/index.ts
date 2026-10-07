import { VidaBoaDB } from './dexie/db';
import { createDexieStore } from './dexie/store';
import type { DataStore } from './repositories';

/**
 * Ponto único de acesso aos dados. O app lê e grava sempre no banco local (IndexedDB);
 * a sincronização com o Supabase (src/lib/data/sync) replica esse banco na nuvem.
 */
export const db = new VidaBoaDB();
export const store: DataStore = createDexieStore(db);

export type { DataStore } from './repositories';

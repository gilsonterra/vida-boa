import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemoteAdapter } from './engine';

/** A nuvem só existe se o build tiver as variáveis do Supabase. */
export const cloudAvailable = !!(PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_PUBLISHABLE_KEY);

let clientPromise: Promise<SupabaseClient> | null = null;

/** Carrega o supabase-js sob demanda, fora do pacote inicial do app. */
export function getClient(): Promise<SupabaseClient> {
	if (!cloudAvailable) throw new Error('Supabase não configurado.');
	clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
		createClient(PUBLIC_SUPABASE_URL!, PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				storageKey: 'vb:auth',
				// PKCE: os links de e-mail voltam com ?code= (e não com tokens no #), o que não
				// conflita com as rotas por hash do app (/#/extrato).
				flowType: 'pkce',
				detectSessionInUrl: true
			}
		})
	);
	return clientPromise;
}

export function supabaseRemote(client: SupabaseClient): RemoteAdapter {
	return {
		async push(table, rows) {
			const { error } = await client.from(table).upsert(rows, { onConflict: 'user_id,id' });
			if (error) throw new Error(error.message);
		},
		async pull(table, since, limit) {
			let q = client
				.from(table)
				.select('*')
				.order('server_updated_at', { ascending: true })
				.limit(limit);
			if (since) q = q.gte('server_updated_at', since);
			const { data, error } = await q;
			if (error) throw new Error(error.message);
			return data ?? [];
		},
		async hasData() {
			const { count, error } = await client
				.from('categories')
				.select('id', { count: 'exact', head: true });
			if (error) throw new Error(error.message);
			return (count ?? 0) > 0;
		}
	};
}

import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Variáveis de ambiente. As duas do Supabase são públicas (a chave "publishable" foi feita
 * para o navegador; quem protege os dados é o RLS) e fixadas no build, já que o GitHub Pages
 * só serve arquivos estáticos. São opcionais: sem elas o app funciona só no aparelho.
 */
const optional = (value: string | undefined) => value?.trim() || undefined;

export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: {
		public: true,
		static: true,
		schema: optional,
		description: 'URL do projeto Supabase (Settings › API).'
	},
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
		public: true,
		static: true,
		schema: optional,
		description: 'Chave "publishable" do projeto Supabase.'
	}
});

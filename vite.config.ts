import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

/**
 * No GitHub Pages o app vive em /<repo>. O workflow de deploy define BASE_PATH=/vida-boa;
 * localmente fica vazio. Para domínio próprio, basta não definir a variável.
 */
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			paths: { base },
			// Rotas por hash (/#/extrato): o GitHub Pages não reescreve URLs de SPA,
			// e assim recarregar qualquer tela nunca dá 404.
			router: { type: 'hash' },
			// Registro manual, para avisar o usuário quando houver versão nova.
			serviceWorker: { register: false }
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});

import { defineConfig, devices } from '@playwright/test';

/** Roda o build de produção sob /vida-boa/, exatamente como no GitHub Pages. */
export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	webServer: {
		command: 'npm run build && npm run preview -- --port 4174 --strictPort',
		env: { BASE_PATH: '/vida-boa' },
		port: 4174,
		reuseExistingServer: false
	},
	use: {
		baseURL: 'http://localhost:4174/vida-boa/',
		...devices['Pixel 7'],
		locale: 'pt-BR'
	}
});

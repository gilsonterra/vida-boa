/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';

/**
 * App shell offline: tudo o que o build gera (JS, CSS, fontes) e os arquivos de /static
 * vão para o cache na instalação. Como o app é 100% local (IndexedDB), depois de instalado
 * ele abre instantaneamente e funciona sem rede.
 *
 * A nova versão fica em espera até o usuário tocar em "Atualizar" (mensagem SKIP_WAITING),
 * para não trocar o código no meio de um lançamento.
 */

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `vida-boa-${version}`;
/** Caminhos do manifesto são relativos ao base path; o escopo do SW é esse base. */
const toUrl = (path: string) => new URL(path.replace(/^\//, ''), sw.registration.scope).pathname;
// Arquivos ocultos (ex.: .nojekyll) não são servidos e quebrariam a instalação inteira.
const ASSETS = [...immutable, ...assets]
	.filter((f) => !f.path.split('/').some((part) => part.startsWith('.')))
	.map((f) => toUrl(f.path));

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...ASSETS, indexPath()])));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('message', (event) => {
	if (event.data === 'SKIP_WAITING') sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Arquivos versionados do build e de /static: cache primeiro.
			if (ASSETS.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			// Navegação: com rotas por hash, toda tela é o mesmo index.html.
			if (request.mode === 'navigate') {
				try {
					const response = await fetch(request);
					// Guarda só o index.html (com rotas por hash, toda tela é ele). Não usa o endereço
					// da navegação como chave: ele pode trazer ?code= de um login por link.
					if (response.ok && url.pathname === indexPath()) cache.put(indexPath(), response.clone());
					return response;
				} catch {
					const shell = await cache.match(indexPath());
					if (shell) return shell;
					throw new Error('offline');
				}
			}

			try {
				return await fetch(request);
			} catch {
				const cached = await cache.match(request);
				if (cached) return cached;
				throw new Error('offline');
			}
		})()
	);
});

function indexPath(): string {
	// O escopo do SW é a raiz do app (ex.: /vida-boa/).
	return new URL('./', sw.registration.scope).pathname;
}

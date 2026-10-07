import { ui } from './stores/ui.svelte';

let waiting: ServiceWorker | null = null;
/** Só recarrega quando a troca de versão foi pedida pelo usuário (não na primeira instalação). */
let updateRequested = false;

/**
 * Registra o service worker e avisa quando houver versão nova instalada e em espera.
 * O caminho é relativo ao documento, então funciona tanto na raiz quanto em /vida-boa/.
 */
export async function registerServiceWorker() {
	if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
	try {
		const url = new URL('service-worker.js', document.baseURI);
		const reg = await navigator.serviceWorker.register(url, { scope: './' });

		const track = (worker: ServiceWorker | null) => {
			if (!worker) return;
			worker.addEventListener('statechange', () => {
				if (worker.state === 'installed' && navigator.serviceWorker.controller) markReady(worker);
			});
		};
		if (reg.waiting && navigator.serviceWorker.controller) markReady(reg.waiting);
		track(reg.installing);
		reg.addEventListener('updatefound', () => track(reg.installing));

		// Ao voltar para o app, procura atualização.
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') reg.update().catch(() => {});
		});

		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (!updateRequested) return;
			updateRequested = false;
			location.reload();
		});
	} catch (err) {
		console.warn('Service worker não registrado', err);
	}
}

function markReady(worker: ServiceWorker) {
	waiting = worker;
	ui.updateReady = true;
}

export function applyUpdate() {
	updateRequested = true;
	waiting?.postMessage('SKIP_WAITING');
}

/** Pede ao navegador para não apagar o IndexedDB por falta de espaço ou de uso. */
export async function requestPersistentStorage() {
	try {
		if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
			await navigator.storage.persist();
		}
	} catch {
		/* sem suporte */
	}
}

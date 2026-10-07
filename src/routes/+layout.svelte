<script lang="ts">
	import './layout.css';
	import { onNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { store } from '#lib/data/index.ts';
	import { today } from '#lib/domain/dates.ts';
	import { applyUpdate, registerServiceWorker, requestPersistentStorage } from '#lib/pwa.ts';
	import { provideAppData } from '#lib/stores/data.svelte.ts';
	import { initInstall } from '#lib/stores/install.svelte.ts';
	import { initTheme } from '#lib/stores/theme.svelte.ts';
	import { openEditor, ui } from '#lib/stores/ui.svelte.ts';
	import Navigation from '#lib/ui/Navigation.svelte';
	import Overlays from '#lib/ui/Overlays.svelte';
	import TransactionEditor from '#lib/ui/TransactionEditor.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	provideAppData();

	onMount(() => {
		initTheme();
		initInstall();
		registerServiceWorker();
		requestPersistentStorage();
		store.ensureSeed().then(() => store.recurring.materialize(today()));

		// Atalho do ícone instalado: "Novo lançamento".
		if (page.url.searchParams.has('novo')) {
			openEditor({ defaults: { kind: 'expense' } });
			replaceState(page.url.pathname, {});
		}
	});

	// Transição nativa entre telas, onde o navegador suportar.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<Navigation />

<main>
	{@render children()}
</main>

{#if ui.editor}
	{#key ui.editor}
		<TransactionEditor request={ui.editor} />
	{/key}
{/if}

<Overlays />

{#if ui.updateReady}
	<div class="update" role="status">
		<span>Nova versão disponível</span>
		<button type="button" onclick={applyUpdate}>Atualizar</button>
	</div>
{/if}

<style>
	main {
		max-width: 760px;
		margin: 0 auto;
		padding-bottom: calc(108px + env(safe-area-inset-bottom));
	}
	@media (min-width: 900px) {
		main {
			margin-left: max(232px, calc(232px + (100vw - 232px - 760px) / 2));
			padding: 24px 24px 64px;
		}
	}
	.update {
		position: fixed;
		top: calc(12px + env(safe-area-inset-top));
		left: 50%;
		transform: translateX(-50%);
		z-index: 90;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 10px 12px 10px 18px;
		border-radius: 999px;
		background: var(--ink);
		color: var(--paper);
		font-size: 14px;
		box-shadow: 0 12px 32px -8px rgb(0 0 0 / 0.35);
	}
	.update button {
		padding: 6px 14px;
		border-radius: 999px;
		background: var(--brass);
		color: #17231c;
		font-weight: 600;
	}
</style>

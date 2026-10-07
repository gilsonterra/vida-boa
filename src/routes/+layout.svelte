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
	import { cloud, initCloud } from '#lib/stores/sync.svelte.ts';
	import { initTheme } from '#lib/stores/theme.svelte.ts';
	import { openEditor, ui } from '#lib/stores/ui.svelte.ts';
	import AuthScreen from '#lib/ui/AuthScreen.svelte';
	import Navigation from '#lib/ui/Navigation.svelte';
	import Overlays from '#lib/ui/Overlays.svelte';
	import Splash from '#lib/ui/Splash.svelte';
	import SyncIndicator from '#lib/ui/SyncIndicator.svelte';
	import TransactionEditor from '#lib/ui/TransactionEditor.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	provideAppData();

	/** O splash fica pelo menos um instante, para não piscar. */
	let minSplashDone = $state(false);
	const showSplash = $derived(!cloud.ready || !minSplashDone);
	const signedIn = $derived(!!cloud.user && !cloud.recovery);

	onMount(() => {
		initTheme();
		initInstall();
		registerServiceWorker();
		requestPersistentStorage();
		setTimeout(() => (minSplashDone = true), 700);
		// Dados iniciais antes da sessão: ao entrar, a conta decide se eles sobem ou são trocados.
		store.ensureSeed().then(() => initCloud());
	});

	// Com a sessão aberta: lança recorrentes vencidos e atende o atalho "Novo lançamento".
	$effect(() => {
		if (!signedIn) return;
		void store.recurring.materialize(today());
		void store.loans.materialize(today());
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

{#if !cloud.ready}
	<!-- Só o splash enquanto a sessão é verificada. -->
{:else if !cloud.available}
	<div class="config">
		<h1>Configuração incompleta</h1>
		<p>
			Este build não tem as variáveis do Supabase (PUBLIC_SUPABASE_URL e
			PUBLIC_SUPABASE_PUBLISHABLE_KEY). Veja o README.
		</p>
	</div>
{:else if !signedIn}
	<AuthScreen />
{:else}
	<Navigation />

	<main>
		{@render children()}
	</main>

	{#if ui.editor}
		{#key ui.editor}
			<TransactionEditor request={ui.editor} />
		{/key}
	{/if}

	<SyncIndicator />
{/if}

<Overlays />

{#if showSplash}
	<Splash />
{/if}

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
			margin-left: max(256px, calc(256px + (100vw - 256px - 760px) / 2));
			padding: 24px 24px 64px;
		}
	}
	/* A tela inicial usa a largura toda em telas grandes (duas colunas). */
	@media (min-width: 1100px) {
		main:has(> :global(.wide)) {
			max-width: 1240px;
			margin-left: max(256px, calc(256px + (100vw - 256px - 1240px) / 2));
		}
	}
	.config {
		max-width: 480px;
		margin: 20vh auto 0;
		padding: 0 24px;
	}
	.config p {
		margin-top: 12px;
		color: var(--ink-2);
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

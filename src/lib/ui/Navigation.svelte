<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		ArrowLeftRight,
		ChartColumn,
		FileUp,
		Gem,
		House,
		List,
		Plus,
		Settings2
	} from '@lucide/svelte';
	import { openEditor } from '../stores/ui.svelte';
	import Sheet from './Sheet.svelte';
	import { goto } from '$app/navigation';

	const tabs = [
		{ href: resolve('/'), path: '/', label: 'Início', icon: House },
		{ href: resolve('/extrato'), path: '/extrato', label: 'Extrato', icon: List },
		{ href: resolve('/relatorios'), path: '/relatorios', label: 'Relatórios', icon: ChartColumn },
		{ href: resolve('/ajustes'), path: '/ajustes', label: 'Ajustes', icon: Settings2 }
	];

	let actionsOpen = $state(false);

	function isActive(path: string) {
		const current = page.url.pathname;
		return path === '/' ? current === '/' : current.startsWith(path);
	}

	function act(fn: () => void) {
		actionsOpen = false;
		fn();
	}
</script>

{#snippet tab(t: (typeof tabs)[number])}
	<a
		href={t.href}
		class="tab"
		class:active={isActive(t.path)}
		aria-current={isActive(t.path) ? 'page' : undefined}
	>
		<t.icon size={22} strokeWidth={isActive(t.path) ? 1.9 : 1.5} />
		<span>{t.label}</span>
	</a>
{/snippet}

<!-- Barra inferior (celular) -->
<nav class="tabbar pb-safe" aria-label="Principal">
	{@render tab(tabs[0])}
	{@render tab(tabs[1])}
	<button type="button" class="add" onclick={() => (actionsOpen = true)} aria-label="Adicionar">
		<Plus size={24} strokeWidth={1.75} />
	</button>
	{@render tab(tabs[2])}
	{@render tab(tabs[3])}
</nav>

<!-- Trilho lateral (telas largas) -->
<nav class="rail" aria-label="Principal">
	<a href={resolve('/')} class="brand"><Gem size={24} strokeWidth={1.5} class="gem" />Vida Boa</a>
	<button type="button" class="rail-add" onclick={() => (actionsOpen = true)}>
		<Plus size={18} strokeWidth={1.75} />Adicionar
	</button>
	<div class="rail-tabs">
		{#each tabs as t (t.path)}{@render tab(t)}{/each}
	</div>
</nav>

<Sheet bind:open={actionsOpen} title="Adicionar">
	<div class="actions">
		<button type="button" onclick={() => act(() => openEditor({ defaults: { kind: 'expense' } }))}>
			<span class="ico"><Plus size={20} strokeWidth={1.6} /></span>
			<span><strong>Novo lançamento</strong><small>Despesa ou receita digitada à mão</small></span>
		</button>
		<button type="button" onclick={() => act(() => openEditor({ defaults: { kind: 'transfer' } }))}>
			<span class="ico"><ArrowLeftRight size={20} strokeWidth={1.6} /></span>
			<span
				><strong>Transferência</strong><small>Entre suas contas, sem contar como gasto</small></span
			>
		</button>
		<button type="button" onclick={() => act(() => goto(resolve('/importar')))}>
			<span class="ico"><FileUp size={20} strokeWidth={1.6} /></span>
			<span><strong>Importar extrato</strong><small>Arquivo OFX do seu banco ou cartão</small></span
			>
		</button>
	</div>
</Sheet>

<style>
	.tabbar {
		view-transition-name: tabbar;
		position: fixed;
		inset: auto 0 0 0;
		z-index: 40;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		align-items: center;
		background: color-mix(in oklab, var(--paper) 86%, transparent);
		backdrop-filter: saturate(1.4) blur(18px);
		-webkit-backdrop-filter: saturate(1.4) blur(18px);
		border-top: 1px solid var(--rule);
	}
	.tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 9px 0 7px;
		font-size: 11px;
		color: var(--ink-3);
		transition: color 140ms;
	}
	.tab.active {
		color: var(--accent);
	}
	.add {
		justify-self: center;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 0 6px 18px -6px color-mix(in oklab, var(--accent) 70%, transparent);
		transition: transform 140ms;
	}
	.add:active {
		transform: scale(0.94);
	}
	.rail {
		display: none;
	}
	.actions {
		display: flex;
		flex-direction: column;
	}
	.actions button {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 0;
		text-align: left;
		border-bottom: 1px solid var(--rule);
	}
	.actions button:last-child {
		border-bottom: 0;
	}
	.actions strong {
		display: block;
		font-weight: 500;
	}
	.actions small {
		display: block;
		font-size: 13px;
		color: var(--ink-2);
	}
	.ico {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 14px;
		background: var(--accent-soft);
		color: var(--accent);
		flex-shrink: 0;
	}

	@media (min-width: 900px) {
		.tabbar {
			display: none;
		}
		.rail {
			position: fixed;
			inset: 0 auto 0 0;
			width: 232px;
			display: flex;
			flex-direction: column;
			gap: 28px;
			padding: 32px 20px;
			border-right: 1px solid var(--rule);
		}
		.brand {
			display: flex;
			align-items: center;
			gap: 10px;
			font-family: var(--font-serif);
			font-style: italic;
			font-weight: 330;
			font-size: 25px;
			font-variation-settings: 'opsz' 144;
			padding-left: 8px;
		}
		.brand :global(.gem) {
			color: var(--brass);
		}
		.rail-add {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			height: 44px;
			border-radius: 999px;
			background: var(--accent);
			color: var(--on-accent);
			font-weight: 500;
		}
		.rail-tabs {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}
		.rail-tabs .tab {
			flex-direction: row;
			gap: 12px;
			padding: 10px 12px;
			border-radius: 12px;
			font-size: 15px;
			color: var(--ink-2);
		}
		.rail-tabs .tab.active {
			color: var(--ink);
			background: var(--accent-soft);
		}
	}
</style>

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

	/** Pela rota, não pelo caminho: no roteador por hash o caminho é sempre o da raiz do app. */
	function isActive(path: string) {
		const current = page.route.id ?? '';
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
		<t.icon size={20} strokeWidth={isActive(t.path) ? 2 : 1.6} />
		<span>{t.label}</span>
	</a>
{/snippet}

<!-- Doca inferior (celular): pílula com as abas e o botão de adicionar ao lado. -->
<div class="dock">
	<nav class="tabbar" aria-label="Principal">
		{#each tabs as t (t.path)}{@render tab(t)}{/each}
	</nav>
	<button type="button" class="add" onclick={() => (actionsOpen = true)} aria-label="Adicionar">
		<Plus size={24} strokeWidth={2} />
	</button>
</div>

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
	.dock {
		view-transition-name: tabbar;
		position: fixed;
		left: 0;
		right: 0;
		bottom: calc(14px + env(safe-area-inset-bottom));
		z-index: 40;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 8px;
		pointer-events: none;
	}
	.tabbar,
	.add {
		pointer-events: auto;
	}
	.tabbar {
		display: flex;
		gap: 2px;
		padding: 5px;
		border-radius: 999px;
		background: color-mix(in oklab, var(--surface) 92%, transparent);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		box-shadow:
			0 0 0 1px var(--rule),
			0 10px 30px -12px var(--shade);
	}
	.tab {
		display: flex;
		align-items: center;
		gap: 7px;
		height: 44px;
		padding: 0 13px;
		border-radius: 999px;
		font-size: 14px;
		font-weight: 600;
		color: var(--ink-2);
		transition:
			background-color 200ms,
			color 200ms;
	}
	/* Na doca, só a aba atual mostra o nome; as outras ficam no ícone (o nome segue acessível). */
	.tabbar .tab:not(.active) span {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.tabbar .tab.active {
		background: var(--brass);
		color: var(--on-accent);
	}
	.add {
		display: grid;
		place-items: center;
		width: 54px;
		height: 54px;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 0 10px 24px -10px color-mix(in oklab, var(--accent) 80%, transparent);
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
		gap: 8px;
	}
	.actions button {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		text-align: left;
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow-card);
	}
	.actions strong {
		display: block;
		font-weight: 600;
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
		border-radius: 999px;
		background: var(--hi);
		color: var(--on-hi);
		flex-shrink: 0;
	}

	/* Telas largas: painel claro à esquerda, como nas referências. */
	@media (min-width: 900px) {
		.dock {
			display: none;
		}
		.rail {
			position: fixed;
			top: 12px;
			bottom: 12px;
			left: 12px;
			width: 232px;
			display: flex;
			flex-direction: column;
			gap: 28px;
			padding: 28px 16px;
			border-radius: 28px;
			background: var(--surface);
			box-shadow: var(--shadow-card);
		}
		.brand {
			display: flex;
			align-items: center;
			gap: 10px;
			font-family: var(--font-display);
			font-weight: 700;
			font-size: 24px;
			color: var(--accent);
			padding-left: 8px;
		}
		.rail-add {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			height: 46px;
			border-radius: 999px;
			background: var(--accent);
			color: var(--on-accent);
			font-weight: 600;
		}
		.rail-tabs {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.rail-tabs .tab {
			gap: 12px;
			font-size: 15px;
			font-weight: 500;
		}
		.rail-tabs .tab.active {
			color: var(--on-hi);
			background: var(--hi);
			font-weight: 600;
		}
	}
</style>

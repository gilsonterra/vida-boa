<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		ArrowLeftRight,
		ChevronDown,
		FileUp,
		FolderOpen,
		House,
		List,
		Plus,
		Settings2
	} from '@lucide/svelte';
	import { openEditor } from '../stores/ui.svelte';
	import Logo from './Logo.svelte';
	import Sheet from './Sheet.svelte';
	import { goto } from '$app/navigation';

	interface Sub {
		href: string;
		path: string;
		label: string;
	}

	interface Tab {
		href: string;
		path: string;
		label: string;
		icon: typeof House;
		/** Telas dentro da aba: acendem a aba e viram submenu na barra do topo. */
		subs?: Sub[];
	}

	const tabs: Tab[] = [
		{ href: resolve('/'), path: '/', label: 'Início', icon: House },
		{ href: resolve('/extrato'), path: '/extrato', label: 'Extrato', icon: List },
		{
			href: resolve('/cadastros'),
			path: '/cadastros',
			label: 'Cadastros',
			icon: FolderOpen,
			subs: [
				{ href: resolve('/contas'), path: '/contas', label: 'Contas e cartões' },
				{ href: resolve('/financiamentos'), path: '/financiamentos', label: 'Financiamentos' },
				{ href: resolve('/tipos-de-conta'), path: '/tipos-de-conta', label: 'Tipos de conta' },
				{ href: resolve('/categorias'), path: '/categorias', label: 'Categorias' },
				{ href: resolve('/regras'), path: '/regras', label: 'Regras de categorização' },
				{ href: resolve('/recorrentes'), path: '/recorrentes', label: 'Lançamentos recorrentes' },
				{ href: resolve('/importacoes'), path: '/importacoes', label: 'Histórico de importações' }
			]
		},
		{ href: resolve('/ajustes'), path: '/ajustes', label: 'Ajustes', icon: Settings2 }
	];

	let actionsOpen = $state(false);

	/** Pela rota, não pelo caminho: no roteador por hash o caminho é sempre o da raiz do app. */
	function isActive(t: Tab | Sub) {
		const current = page.route.id ?? '';
		if (t.path === '/') return current === '/';
		const subs = 'subs' in t ? (t.subs ?? []) : [];
		return [t.path, ...subs.map((s) => s.path)].some((p) => current.startsWith(p));
	}

	function act(fn: () => void) {
		actionsOpen = false;
		fn();
	}
</script>

{#snippet tab(t: Tab)}
	<a
		href={t.href}
		class="tab"
		class:active={isActive(t)}
		aria-current={isActive(t) ? 'page' : undefined}
	>
		<t.icon size={20} strokeWidth={isActive(t) ? 2 : 1.6} />
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

<!-- Barra no topo (telas largas) -->
<nav class="topbar" aria-label="Principal">
	<a href={resolve('/')} class="brand"><Logo size={36} />Vida Boa</a>
	<div class="top-tabs">
		{#each tabs as t (t.path)}
			{#if t.subs}
				<!-- Abre ao passar o mouse ou ao focar com o teclado; clicar na aba abre a tela dela. -->
				<div class="menu">
					<a
						href={t.href}
						class="tab"
						class:active={isActive(t)}
						aria-current={isActive(t) ? 'page' : undefined}
						aria-haspopup="true"
					>
						<t.icon size={20} strokeWidth={isActive(t) ? 2 : 1.6} />
						<span>{t.label}</span>
						<ChevronDown size={16} strokeWidth={1.75} class="chev" />
					</a>
					<ul class="subs">
						{#each t.subs as sub (sub.path)}
							<li>
								<a
									href={sub.href}
									class:active={isActive(sub)}
									aria-current={isActive(sub) ? 'page' : undefined}
									onclick={(e) => e.currentTarget.blur()}>{sub.label}</a
								>
							</li>
						{/each}
					</ul>
				</div>
			{:else}
				{@render tab(t)}
			{/if}
		{/each}
	</div>
	<button type="button" class="top-add" onclick={() => (actionsOpen = true)}>
		<Plus size={18} strokeWidth={1.75} />Adicionar
	</button>
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
	.topbar {
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

	/* Telas largas: barra clara fixa no topo, com a marca, as abas e o botão de adicionar. */
	@media (min-width: 900px) {
		.dock {
			display: none;
		}
		.topbar {
			position: fixed;
			top: 12px;
			left: 12px;
			right: 12px;
			z-index: 40;
			height: 64px;
			display: flex;
			align-items: center;
			gap: 24px;
			padding: 0 12px 0 20px;
			border-radius: 999px;
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
			white-space: nowrap;
		}
		.top-tabs {
			flex: 1;
			display: flex;
			justify-content: center;
			gap: 4px;
		}
		.top-tabs .tab {
			gap: 8px;
			font-size: 15px;
			font-weight: 500;
		}
		.top-tabs .tab.active {
			color: var(--on-hi);
			background: var(--hi);
			font-weight: 600;
		}
		.menu {
			position: relative;
		}
		.menu :global(.chev) {
			margin-left: -2px;
			transition: transform 160ms;
		}
		.menu:hover :global(.chev),
		.menu:focus-within :global(.chev) {
			transform: rotate(180deg);
		}
		.subs {
			position: absolute;
			top: calc(100% + 10px);
			left: 50%;
			min-width: 240px;
			margin: 0;
			padding: 6px;
			list-style: none;
			border-radius: 20px;
			background: var(--surface);
			box-shadow:
				0 0 0 1px var(--rule),
				0 18px 40px -16px var(--shade);
			opacity: 0;
			visibility: hidden;
			transform: translate(-50%, -4px);
			transition:
				opacity 140ms,
				transform 140ms,
				visibility 140ms;
		}
		/* Ponte invisível entre a aba e a lista, para o mouse não "cair" no vão. */
		.subs::before {
			content: '';
			position: absolute;
			left: 0;
			right: 0;
			top: -10px;
			height: 10px;
		}
		.menu:hover .subs,
		.menu:focus-within .subs {
			opacity: 1;
			visibility: visible;
			transform: translate(-50%, 0);
		}
		.subs a {
			display: block;
			padding: 10px 14px;
			border-radius: 14px;
			font-size: 15px;
			color: var(--ink);
			white-space: nowrap;
		}
		.subs a:hover,
		.subs a:focus-visible {
			background: color-mix(in oklab, var(--hi) 55%, transparent);
		}
		.subs a.active {
			background: var(--hi);
			color: var(--on-hi);
			font-weight: 600;
		}
		.top-add {
			display: flex;
			align-items: center;
			gap: 8px;
			height: 44px;
			padding: 0 20px;
			border-radius: 999px;
			background: var(--accent);
			color: var(--on-accent);
			font-weight: 600;
			white-space: nowrap;
		}
	}
</style>

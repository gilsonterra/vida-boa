<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronRight } from '@lucide/svelte';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';

	const data = useAppData();

	const links = $derived([
		{ href: resolve('/contas'), label: 'Contas e cartões', count: data.activeAccounts.length },
		{ href: resolve('/financiamentos'), label: 'Financiamentos', count: data.loans.length },
		{ href: resolve('/tipos-de-conta'), label: 'Tipos de conta', count: data.types.length },
		{ href: resolve('/categorias'), label: 'Categorias', count: data.categories.length },
		{ href: resolve('/regras'), label: 'Regras de categorização', count: data.rules.length },
		{
			href: resolve('/recorrentes'),
			label: 'Lançamentos recorrentes',
			count: data.recurring.length
		},
		{ href: resolve('/importacoes'), label: 'Histórico de importações', count: data.imports.length }
	]);
</script>

<PageHeader title="Cadastros" />

<div class="page">
	<ul>
		{#each links as l (l.href)}
			<li>
				<a class="row link" href={l.href}>
					<span class="grow">{l.label}</span>
					<span class="count tabular">{l.count}</span>
					<ChevronRight size={16} strokeWidth={1.5} />
				</a>
			</li>
		{/each}
	</ul>
</div>

<style>
	.page {
		padding-inline: 20px;
	}
	.link {
		min-height: 54px;
		color: var(--ink);
	}
	.link :global(svg) {
		color: var(--ink-3);
	}
	.grow {
		flex: 1;
	}
	.count {
		color: var(--ink-3);
		font-size: 14px;
	}
</style>

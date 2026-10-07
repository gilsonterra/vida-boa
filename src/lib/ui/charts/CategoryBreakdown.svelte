<script lang="ts">
	import type { CategoryTotal } from '../../domain/reports';
	import { useAppData } from '../../stores/data.svelte';
	import Amount from '../Amount.svelte';
	import CategoryMark from '../CategoryMark.svelte';

	/**
	 * Ranking de categorias: nome, valor, participação e uma régua fina proporcional
	 * ao maior gasto. Lê-se como uma tabela, não como um gráfico decorativo.
	 */
	interface Props {
		totals: CategoryTotal[];
		limit?: number;
	}

	let { totals, limit = 8 }: Props = $props();
	const data = useAppData();
	let expanded = $state(false);

	const sum = $derived(totals.reduce((s, t) => s + t.totalCents, 0));
	const top = $derived(totals[0]?.totalCents || 1);
	const visible = $derived(expanded ? totals : totals.slice(0, limit));
	const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
</script>

<ul>
	{#each visible as t (t.categoryId)}
		{@const c = t.categoryId ? data.categoryById.get(t.categoryId) : undefined}
		<li class="row">
			<CategoryMark category={c} size={36} />
			<div class="main">
				<div class="line">
					<span class="name">{c?.name ?? 'Sem categoria'}</span>
					<Amount cents={t.totalCents} size="sm" />
				</div>
				<div class="line sub">
					<span class="rail"
						><span
							style:width="{(t.totalCents / top) * 100}%"
							style:background={c?.color ?? 'var(--ink-3)'}
						></span></span
					>
					<span class="pct">{pct.format(t.totalCents / sum)}</span>
				</div>
			</div>
		</li>
	{/each}
</ul>
{#if totals.length > limit}
	<button type="button" class="more" onclick={() => (expanded = !expanded)}>
		{expanded ? 'Mostrar menos' : `Ver todas as ${totals.length} categorias`}
	</button>
{/if}

<style>
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rail {
		flex: 1;
		height: 3px;
		border-radius: 9px;
		background: var(--sunken);
		overflow: hidden;
	}
	.rail span {
		display: block;
		height: 100%;
		border-radius: 9px;
	}
	.pct {
		width: 3.2em;
		text-align: right;
		font-size: 12px;
		color: var(--ink-3);
		font-variant-numeric: tabular-nums;
	}
	.more {
		margin-top: 12px;
		font-size: 14px;
		color: var(--accent);
	}
</style>

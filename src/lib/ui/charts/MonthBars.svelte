<script lang="ts">
	import { formatMonth, formatMonthShort, type MonthKey } from '../../domain/dates';
	import { formatCents } from '../../domain/money';
	import { ui } from '../../stores/ui.svelte';

	/** Entradas e saídas por mês, em pares de barras finas. Toque num mês para ler os valores. */
	interface Props {
		series: Array<{ month: MonthKey; incomeCents: number; expenseCents: number }>;
		selected?: MonthKey;
		onselect?: (month: MonthKey) => void;
	}

	let { series, selected, onselect }: Props = $props();

	const H = 140;
	const max = $derived(Math.max(1, ...series.flatMap((s) => [s.incomeCents, s.expenseCents])));
	const h = (v: number) => Math.max(v > 0 ? 2 : 0, (v / max) * H);
</script>

<div class="legend">
	<span><i class="in"></i>Entradas</span>
	<span><i class="out"></i>Saídas</span>
</div>
<div class="chart" style:height="{H + 24}px">
	{#each series as s (s.month)}
		<button
			type="button"
			class="col"
			class:on={s.month === selected}
			onclick={() => onselect?.(s.month)}
			aria-label="{formatMonth(s.month)}: entradas {ui.privacy
				? 'ocultas'
				: formatCents(s.incomeCents)}, saídas {ui.privacy
				? 'ocultas'
				: formatCents(s.expenseCents)}"
		>
			<span class="bars" style:height="{H}px">
				<span class="bar in" style:height="{h(s.incomeCents)}px"></span>
				<span class="bar out" style:height="{h(s.expenseCents)}px"></span>
			</span>
			<span class="m">{formatMonthShort(s.month)}</span>
		</button>
	{/each}
</div>

<style>
	.legend {
		display: flex;
		gap: 16px;
		margin-bottom: 14px;
		font-size: 12px;
		color: var(--ink-2);
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.legend i {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}
	.in {
		background: var(--gain);
	}
	.out {
		background: var(--loss);
	}
	.chart {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		align-items: end;
		gap: 2px;
		border-bottom: 1px solid var(--rule);
		padding-bottom: 0;
	}
	.col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		height: 100%;
		justify-content: flex-end;
		border-radius: 8px;
		padding-top: 4px;
	}
	.col.on {
		background: var(--accent-soft);
	}
	.bars {
		display: flex;
		align-items: flex-end;
		gap: 2px;
	}
	.bar {
		width: 7px;
		border-radius: 2px 2px 0 0;
		transition: height 400ms var(--ease-out-quint);
	}
	.bar.out {
		opacity: 0.8;
	}
	.m {
		font-size: 11px;
		color: var(--ink-3);
		padding-bottom: 4px;
	}
	.col.on .m {
		color: var(--ink);
		font-weight: 500;
	}
</style>

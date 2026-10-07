<script lang="ts">
	import { ArrowDownRight, ArrowUpRight, Minus } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { ui } from '../stores/ui.svelte';
	import Amount from './Amount.svelte';

	/**
	 * Selo de tendência: seta + valor (em reais ou percentual) num fundo suave.
	 * `goodWhen` diz se subir é bom (patrimônio, resultado) ou ruim (gastos).
	 */
	interface Props {
		cents?: number;
		/** Variação relativa (0.12 = +12%). */
		ratio?: number;
		goodWhen?: 'up' | 'down';
		children?: Snippet;
	}

	let { cents, ratio, goodWhen = 'up', children }: Props = $props();

	const value = $derived(cents ?? ratio ?? 0);
	const direction = $derived(value > 0 ? 'up' : value < 0 ? 'down' : 'flat');
	const tone = $derived(direction === 'flat' ? 'flat' : direction === goodWhen ? 'good' : 'bad');
	const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
</script>

<span class="trend {tone}">
	<span class="arrow" aria-hidden="true">
		{#if direction === 'up'}<ArrowUpRight size={14} strokeWidth={2.2} />
		{:else if direction === 'down'}<ArrowDownRight size={14} strokeWidth={2.2} />
		{:else}<Minus size={14} strokeWidth={2.2} />{/if}
	</span>
	{#if cents !== undefined}
		<Amount {cents} size="sm" signed class="trend-amount" />
	{:else if ratio !== undefined}
		<span class="figures pct">
			{ui.privacy
				? '••'
				: `${ratio > 0 ? '+' : ratio < 0 ? '−' : ''}${pct.format(Math.abs(ratio))}`}
		</span>
	{/if}
	{#if children}<span class="text">{@render children()}</span>{/if}
</span>

<style>
	.trend {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px 4px 5px;
		border-radius: 999px;
		font-size: 13px;
		white-space: nowrap;
	}
	.arrow {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 99px;
	}
	.good {
		background: var(--gain-soft);
		color: var(--gain);
	}
	.good .arrow {
		background: var(--gain);
		color: var(--paper);
	}
	.bad {
		background: var(--loss-soft);
		color: var(--loss);
	}
	.bad .arrow {
		background: var(--loss);
		color: var(--paper);
	}
	.flat {
		background: var(--sunken);
		color: var(--ink-2);
	}
	.trend :global(.trend-amount) {
		font-size: 14px;
		font-weight: 500;
	}
	.pct {
		font-size: 14px;
		font-weight: 500;
	}
	.text {
		color: var(--ink-2);
	}
</style>

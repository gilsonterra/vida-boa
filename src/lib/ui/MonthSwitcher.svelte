<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { formatMonth, monthKey, shiftMonth, today, type MonthKey } from '../domain/dates';

	interface Props {
		value: MonthKey;
		/** Limites de navegação; por padrão não passa do mês atual. `null` libera. */
		min?: MonthKey | null;
		max?: MonthKey | null;
		/** Conteúdo ao lado esquerdo do botão de avançar (ex.: voltar para hoje). */
		beforeNext?: Snippet;
	}

	const current = monthKey(today());
	let { value = $bindable(), min = null, max = current, beforeNext }: Props = $props();
</script>

<div class="switcher">
	<button
		type="button"
		onclick={() => (value = shiftMonth(value, -1))}
		aria-label="Mês anterior"
		disabled={min !== null && value <= min}
	>
		<ChevronLeft size={18} strokeWidth={1.75} />
	</button>
	<span class="label" aria-live="polite">{formatMonth(value)}</span>
	<span class="end">
		{@render beforeNext?.()}
		<button
			type="button"
			onclick={() => (value = shiftMonth(value, 1))}
			aria-label="Próximo mês"
			disabled={max !== null && value >= max}
		>
			<ChevronRight size={18} strokeWidth={1.75} />
		</button>
	</span>
</div>

<style>
	.switcher {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.label {
		font-family: var(--font-display);
		font-size: 19px;
	}
	.end {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	button {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 999px;
		color: var(--ink-2);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	button:disabled {
		opacity: 0.3;
	}
</style>

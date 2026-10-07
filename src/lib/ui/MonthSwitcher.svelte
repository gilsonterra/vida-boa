<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { formatMonth, monthKey, shiftMonth, today, type MonthKey } from '../domain/dates';

	interface Props {
		value: MonthKey;
	}

	let { value = $bindable() }: Props = $props();
	const current = monthKey(today());
</script>

<div class="switcher">
	<button type="button" onclick={() => (value = shiftMonth(value, -1))} aria-label="Mês anterior">
		<ChevronLeft size={18} strokeWidth={1.75} />
	</button>
	<span class="label" aria-live="polite">{formatMonth(value)}</span>
	<button
		type="button"
		onclick={() => (value = shiftMonth(value, 1))}
		aria-label="Próximo mês"
		disabled={value >= current}
	>
		<ChevronRight size={18} strokeWidth={1.75} />
	</button>
</div>

<style>
	.switcher {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.label {
		font-family: var(--font-serif);
		font-size: 19px;
		font-variation-settings: 'opsz' 36;
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

<script lang="ts">
	import { ArrowDownLeft, ArrowUpRight, Scale } from '@lucide/svelte';
	import Amount from './Amount.svelte';

	/**
	 * Bloco de resumo: entradas (seta chegando, verde), saídas (seta saindo, vermelho)
	 * ou resultado (balança, cor pelo sinal).
	 */
	interface Props {
		kind: 'in' | 'out' | 'net';
		cents: number;
		label?: string;
		size?: 'sm' | 'md';
	}

	let { kind, cents, label, size = 'md' }: Props = $props();

	const text = $derived(
		label ?? (kind === 'in' ? 'Entradas' : kind === 'out' ? 'Saídas' : 'Resultado')
	);
	const tone = $derived(
		kind === 'in' ? 'gain' : kind === 'out' ? 'loss' : cents >= 0 ? 'gain' : 'loss'
	);
</script>

<div class="flow {tone}" class:small={size === 'sm'}>
	<span class="ico" aria-hidden="true">
		{#if kind === 'in'}<ArrowDownLeft size={size === 'sm' ? 13 : 15} strokeWidth={2.2} />
		{:else if kind === 'out'}<ArrowUpRight size={size === 'sm' ? 13 : 15} strokeWidth={2.2} />
		{:else}<Scale size={size === 'sm' ? 13 : 15} strokeWidth={2} />{/if}
	</span>
	<span class="label">{text}</span>
	<Amount
		cents={kind === 'out' ? -Math.abs(cents) : kind === 'in' ? Math.abs(cents) : cents}
		{size}
		signed
		tone={kind === 'net' ? 'auto' : tone}
		class="flow-amount"
	/>
</div>

<style>
	.flow {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		column-gap: 8px;
		row-gap: 4px;
	}
	.ico {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 99px;
	}
	.small .ico {
		width: 19px;
		height: 19px;
	}
	.gain .ico {
		background: var(--gain-soft);
		color: var(--gain);
	}
	.loss .ico {
		background: var(--loss-soft);
		color: var(--loss);
	}
	.label {
		font-size: 13px;
		color: var(--ink-2);
	}
	.small .label {
		font-size: 12px;
	}
	.flow :global(.flow-amount) {
		grid-column: 1 / -1;
	}
</style>

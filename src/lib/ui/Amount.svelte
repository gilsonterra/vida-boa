<script lang="ts" module>
	export type Tone = 'neutral' | 'auto' | 'gain' | 'loss' | 'debt';
</script>

<script lang="ts">
	import { ui } from '../stores/ui.svelte';

	/**
	 * Valor monetário com a assinatura visual do app: algarismos em pixel,
	 * símbolo e centavos menores, como num extrato de banco privado.
	 *
	 * Tom: `auto` pinta ganhos de verde e perdas de vermelho; `debt` só destaca saldo negativo;
	 * `gain`/`loss` forçam a cor (ex.: total de entradas, total de saídas).
	 * O indicador (▲ ▼) repete a informação da cor, para não depender só dela.
	 */
	interface Props {
		cents: number;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		/** Mostra "+" em valores positivos ("−" aparece sempre). */
		signed?: boolean;
		tone?: Tone;
		/** Triângulo ▲/▼ antes do valor, na cor do tom. */
		indicator?: boolean;
		hidden?: boolean;
		class?: string;
	}

	let {
		cents,
		size = 'md',
		signed = false,
		tone = 'neutral',
		indicator = false,
		hidden: hiddenProp = false,
		class: klass = ''
	}: Props = $props();
	const hidden = $derived(hiddenProp || ui.privacy);

	const parts = $derived.by(() => {
		const abs = Math.abs(cents);
		const int = Math.floor(abs / 100).toLocaleString('pt-BR');
		const dec = String(abs % 100).padStart(2, '0');
		const sign = cents < 0 ? '−' : signed && cents > 0 ? '+' : '';
		return { int, dec, sign };
	});

	const color = $derived.by(() => {
		if (tone === 'gain' || tone === 'loss') return tone;
		if (tone === 'auto') return cents > 0 ? 'gain' : cents < 0 ? 'loss' : null;
		if (tone === 'debt') return cents < 0 ? 'loss' : null;
		return null;
	});
	const up = $derived(tone === 'gain' || (tone !== 'loss' && cents > 0));

	const label = $derived(
		new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
	);
</script>

<span
	class="figures amount amount-{size} {klass}"
	class:gain={color === 'gain'}
	class:loss={color === 'loss'}
	aria-label={hidden ? 'Valor oculto' : label}
>
	{#if indicator && cents !== 0}
		<svg class="tri" viewBox="0 0 10 10" aria-hidden="true">
			<path d={up ? 'M5 1.5 9.2 8.5H.8Z' : 'M5 8.5 .8 1.5h8.4Z'} />
		</svg>
	{/if}
	{#if hidden}
		<span aria-hidden="true" class="cur">R$</span><span aria-hidden="true">•••••</span>
	{:else}
		<span aria-hidden="true">{parts.sign}</span><span aria-hidden="true" class="cur">R$</span><span
			aria-hidden="true">{parts.int}</span
		><span aria-hidden="true" class="dec">,{parts.dec}</span>
	{/if}
</span>

<style>
	.amount {
		white-space: nowrap;
	}
	.cur {
		font-size: 0.7em;
		margin-right: 0.2em;
		opacity: 0.7;
	}
	.dec {
		font-size: 0.66em;
		opacity: 0.75;
	}
	.gain {
		color: var(--gain);
	}
	.loss {
		color: var(--loss);
	}
	.tri {
		display: inline-block;
		width: 0.48em;
		height: 0.48em;
		margin-right: 0.3em;
		vertical-align: 0.12em;
		fill: currentColor;
	}
	.amount-xl .tri {
		width: 0.26em;
		height: 0.26em;
		vertical-align: 0.5em;
	}
	/* Valores de lista na grotesca, em negrito; o pixel fica para os números em destaque. */
	.amount-sm,
	.amount-md {
		font-family: var(--font-sans);
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.amount-sm {
		font-size: 15px;
	}
	.amount-md {
		font-size: 18px;
	}
	.amount-lg {
		font-size: 30px;
		font-weight: 700;
	}
	/* O número principal: pixel grande, centavos em expoente, como nas referências. */
	.amount-xl {
		font-size: clamp(44px, 13vw, 60px);
		font-weight: 700;
		line-height: 1;
	}
	.amount-xl .cur,
	.amount-lg .cur {
		font-size: 1em;
		margin-right: 0.28em;
		opacity: 1;
	}
	.amount-xl .dec,
	.amount-lg .dec {
		font-size: 0.32em;
		vertical-align: 1.9em;
		margin-left: 0.12em;
		opacity: 1;
	}
	.amount-lg .dec {
		font-size: 0.42em;
		vertical-align: 1.2em;
	}
</style>

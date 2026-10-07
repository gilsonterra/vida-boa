<script lang="ts">
	import { formatCents } from '../../domain/money';
	import { formatMonth, formatMonthShort, type MonthKey } from '../../domain/dates';
	import { ui } from '../../stores/ui.svelte';

	/**
	 * Evolução do patrimônio: área clara sob a linha e alguns meses marcados com haste e balão
	 * de valor. O mês em leitura (o último, ou o tocado) fica com o balão escuro.
	 */
	interface Props {
		points: Array<{ month: MonthKey; totalCents: number }>;
		height?: number;
	}

	let { points, height = 200 }: Props = $props();

	const W = 320;
	/** Espaço livre no alto para os balões. */
	const TOP = 74;
	const BOTTOM = 8;
	let active = $state<number | null>(null);

	const geometry = $derived.by(() => {
		if (points.length < 2) return null;
		const values = points.map((p) => p.totalCents);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const span = max - min || 1;
		const xs = points.map((_, i) => (i * W) / (points.length - 1));
		const ys = values.map((v) => TOP + (1 - (v - min) / span) * (height - TOP - BOTTOM - 30));
		// Segmentos retos, como nas referências: curva suavizada inventaria picos que não existem.
		const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x},${ys[i]}`).join(' ');
		const area = `${d} L${xs[xs.length - 1]},${height} L${xs[0]},${height} Z`;
		return { d, area, xs, ys };
	});

	const shown = $derived(active ?? points.length - 1);

	/** Até quatro meses marcados, espaçados, sempre incluindo o mês em leitura. */
	const pins = $derived.by(() => {
		const n = points.length;
		if (n < 2) return [];
		const picks = new Set<number>();
		const slots = Math.min(4, n);
		for (let k = 1; k <= slots; k++) picks.add(Math.round((k * (n - 1)) / slots));
		picks.delete(n - 1);
		picks.add(shown);
		return [...picks].filter((i) => i > 0 || n <= 2).sort((a, b) => a - b);
	});

	const compact = new Intl.NumberFormat('pt-BR', {
		notation: 'compact',
		maximumFractionDigits: 1
	});

	function onmove(e: PointerEvent) {
		if (!geometry) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * W;
		let best = 0;
		geometry.xs.forEach((gx, i) => {
			if (Math.abs(gx - x) < Math.abs(geometry.xs[best] - x)) best = i;
		});
		active = best;
	}
</script>

{#if geometry}
	<figure
		style:height="{height}px"
		onpointermove={onmove}
		onpointerleave={() => (active = null)}
		aria-label="Evolução do patrimônio de {formatMonth(points[0].month)} a {formatMonth(
			points[points.length - 1].month
		)}"
	>
		<svg viewBox="0 0 {W} {height}" preserveAspectRatio="none" aria-hidden="true">
			<defs>
				<linearGradient id="nw-fill" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stop-color="var(--hi)" stop-opacity="0.45" />
					<stop offset="1" stop-color="var(--hi)" stop-opacity="0.08" />
				</linearGradient>
			</defs>
			<path d={geometry.area} fill="url(#nw-fill)" />
			<path
				d={geometry.d}
				fill="none"
				stroke="var(--brass)"
				stroke-width="2.5"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		</svg>
		{#each pins as i, k (i)}
			{@const on = i === shown}
			{@const top = Math.max(4, geometry.ys[i] - (k % 2 ? 66 : 44))}
			<span
				class="pin"
				class:on
				style:left="{(geometry.xs[i] / W) * 100}%"
				style:top="{top}px"
				style:--stem="{geometry.ys[i] - top - 26}px"
				style:--bx={i === points.length - 1 ? '-46%' : i === 0 ? '46%' : '0'}
			>
				<span class="bubble figures">
					{ui.privacy ? '•••' : compact.format(points[i].totalCents / 100)}
				</span>
			</span>
		{/each}
	</figure>
	<p class="caption">
		<span>{formatMonthShort(points[0].month)}</span>
		<span class="read" aria-live="polite">
			{formatMonth(points[shown].month)}: {ui.privacy
				? '•••'
				: formatCents(points[shown].totalCents)}
		</span>
		<span>{formatMonthShort(points[points.length - 1].month)}</span>
	</p>
{/if}

<style>
	figure {
		position: relative;
		margin: 0;
		touch-action: pan-y;
		/* Balões nas pontas não podem alargar a página. */
		overflow-x: clip;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	/* Balão com haste até a curva, à moda das referências. */
	.pin {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		transform: translateX(-50%);
		pointer-events: none;
	}
	.pin::after {
		content: '';
		width: 1.5px;
		height: var(--stem);
		background: color-mix(in oklab, var(--brass) 35%, transparent);
	}
	.bubble {
		display: grid;
		place-items: center;
		height: 26px;
		padding: 0 10px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		/* Nas pontas, o balão desliza para dentro; a haste continua sobre o mês. */
		transform: translateX(var(--bx));
		background: color-mix(in oklab, var(--hi) 40%, var(--paper));
		color: var(--brass);
	}
	.pin.on .bubble {
		background: var(--accent);
		color: var(--on-accent);
	}
	.pin.on::after {
		background: var(--accent);
		width: 2px;
	}
	.caption {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		margin-top: 10px;
		font-size: 12px;
		color: var(--ink-3);
	}
	.read {
		color: var(--ink-2);
		font-weight: 500;
	}
</style>

<script lang="ts">
	import { formatCents } from '../../domain/money';
	import { formatMonth, formatMonthShort, type MonthKey } from '../../domain/dates';
	import { ui } from '../../stores/ui.svelte';

	/**
	 * Linha da evolução do patrimônio. Traço fino, sem grade: só o desenho da curva,
	 * o ponto final marcado e os meses de início e fim. Toque ou passe o mouse para ler um mês.
	 */
	interface Props {
		points: Array<{ month: MonthKey; totalCents: number }>;
		height?: number;
	}

	let { points, height = 88 }: Props = $props();

	const W = 320;
	const PAD = 6;
	let active = $state<number | null>(null);

	const geometry = $derived.by(() => {
		if (points.length < 2) return null;
		const values = points.map((p) => p.totalCents);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const span = max - min || 1;
		const xs = points.map((_, i) => PAD + (i * (W - PAD * 2)) / (points.length - 1));
		const ys = values.map((v) => PAD + (1 - (v - min) / span) * (height - PAD * 2));
		// Curva suave (Catmull-Rom convertida em Bézier).
		let d = `M${xs[0]},${ys[0]}`;
		for (let i = 0; i < xs.length - 1; i++) {
			const x0 = xs[i - 1] ?? xs[i];
			const y0 = ys[i - 1] ?? ys[i];
			const x3 = xs[i + 2] ?? xs[i + 1];
			const y3 = ys[i + 2] ?? ys[i + 1];
			const c1x = xs[i] + (xs[i + 1] - x0) / 6;
			const c1y = ys[i] + (ys[i + 1] - y0) / 6;
			const c2x = xs[i + 1] - (x3 - xs[i]) / 6;
			const c2y = ys[i + 1] - (y3 - ys[i]) / 6;
			d += ` C${c1x},${c1y} ${c2x},${c2y} ${xs[i + 1]},${ys[i + 1]}`;
		}
		const area = `${d} L${xs[xs.length - 1]},${height} L${xs[0]},${height} Z`;
		return { d, area, xs, ys };
	});

	function onmove(e: PointerEvent) {
		if (!geometry) return;
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * W;
		let best = 0;
		geometry.xs.forEach((gx, i) => {
			if (Math.abs(gx - x) < Math.abs(geometry.xs[best] - x)) best = i;
		});
		active = best;
	}

	const shown = $derived(active ?? points.length - 1);
</script>

{#if geometry}
	<figure>
		<svg
			viewBox="0 0 {W} {height}"
			preserveAspectRatio="none"
			role="img"
			aria-label="Evolução do patrimônio de {formatMonth(points[0].month)} a {formatMonth(
				points[points.length - 1].month
			)}"
			onpointermove={onmove}
			onpointerleave={() => (active = null)}
		>
			<defs>
				<linearGradient id="nw-fill" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stop-color="var(--accent)" stop-opacity="0.14" />
					<stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
				</linearGradient>
			</defs>
			<path d={geometry.area} fill="url(#nw-fill)" />
			<path
				d={geometry.d}
				fill="none"
				stroke="var(--accent)"
				stroke-width="1.5"
				vector-effect="non-scaling-stroke"
			/>
			{#if active !== null}
				<line
					x1={geometry.xs[active]}
					x2={geometry.xs[active]}
					y1="0"
					y2={height}
					stroke="var(--rule-strong)"
					vector-effect="non-scaling-stroke"
				/>
			{/if}
		</svg>
		<span
			class="dot"
			style:left="{(geometry.xs[shown] / W) * 100}%"
			style:top="{(geometry.ys[shown] / height) * 100}%"
		></span>
		<figcaption>
			<span>{formatMonthShort(points[0].month)}</span>
			<span class="read">
				{#if active !== null}
					{formatMonth(points[active].month)}: {ui.privacy
						? '•••'
						: formatCents(points[active].totalCents)}
				{/if}
			</span>
			<span>{formatMonthShort(points[points.length - 1].month)}</span>
		</figcaption>
	</figure>
{/if}

<style>
	figure {
		position: relative;
		margin: 0;
	}
	svg {
		display: block;
		width: 100%;
		height: 88px;
		overflow: visible;
		touch-action: pan-y;
	}
	.dot {
		position: absolute;
		width: 9px;
		height: 9px;
		margin: -4.5px 0 0 -4.5px;
		border-radius: 99px;
		background: var(--paper);
		box-shadow: 0 0 0 1.5px var(--accent);
		pointer-events: none;
	}
	figcaption {
		display: flex;
		justify-content: space-between;
		margin-top: 8px;
		font-size: 12px;
		color: var(--ink-3);
	}
	.read {
		color: var(--ink-2);
	}
</style>

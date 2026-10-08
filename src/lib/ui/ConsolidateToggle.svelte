<script lang="ts">
	import { Circle, CircleCheck } from '@lucide/svelte';

	/** Marca de consolidado (✓ verde) ou pendente (○), que troca com um toque. */
	interface Props {
		on: boolean;
		onclick: () => void;
		size?: number;
	}

	let { on, onclick, size = 22 }: Props = $props();
</script>

<button
	type="button"
	class="check"
	class:on
	aria-pressed={on}
	aria-label={on
		? 'Consolidado; tocar para marcar como pendente'
		: 'Pendente; tocar para consolidar'}
	title={on ? 'Consolidado' : 'Pendente'}
	{onclick}
>
	{#if on}<CircleCheck {size} strokeWidth={1.8} />{:else}<Circle {size} strokeWidth={1.6} />{/if}
</button>

<style>
	.check {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 999px;
		color: var(--ink-3);
	}
	.check.on {
		color: var(--gain);
	}
	.check:active {
		transform: scale(0.92);
	}
</style>

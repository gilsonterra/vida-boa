<script lang="ts">
	import { ArrowLeftRight, CircleDashed } from '@lucide/svelte';
	import type { Category } from '../domain/types';
	import { categoryIcon } from './icons';

	/** Disco com o ícone da categoria, na cor dela em baixa saturação. */
	interface Props {
		category?: Category;
		transfer?: boolean;
		size?: number;
	}

	let { category, transfer = false, size = 40 }: Props = $props();

	const Icon = $derived(
		transfer ? ArrowLeftRight : category ? categoryIcon(category.icon) : CircleDashed
	);
	const color = $derived(transfer ? 'var(--ink-2)' : (category?.color ?? 'var(--ink-3)'));
</script>

<span
	class="mark tinted"
	style:--c={color}
	style:width="{size}px"
	style:height="{size}px"
	aria-hidden="true"
>
	<Icon size={Math.round(size * 0.45)} strokeWidth={1.6} />
</span>

<style>
	.mark {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		border-radius: 999px;
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		onclick?: (e: MouseEvent) => void;
		href?: string;
		children: Snippet;
	}

	let { label, onclick, href, children }: Props = $props();
</script>

{#if href}
	<a {href} class="icon-btn" aria-label={label} title={label}>{@render children()}</a>
{:else}
	<button type="button" class="icon-btn" aria-label={label} title={label} {onclick}>
		{@render children()}
	</button>
{/if}

<style>
	.icon-btn {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 999px;
		color: var(--ink);
		transition: background-color 120ms;
	}
	.icon-btn:hover {
		background: var(--accent-soft);
	}
</style>

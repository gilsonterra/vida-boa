<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		text: string;
		children?: Snippet;
	}

	let { title, text, children }: Props = $props();
</script>

<div class="empty">
	<p class="title">{title}</p>
	<p class="text">{text}</p>
	{#if children}<div class="actions">{@render children()}</div>{/if}
</div>

<style>
	.empty {
		padding: 40px 8px;
		text-align: center;
	}
	.title {
		font-family: var(--font-serif);
		font-size: 22px;
		font-variation-settings: 'opsz' 48;
	}
	.text {
		margin: 8px auto 0;
		max-width: 34ch;
		color: var(--ink-2);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
		margin-top: 22px;
	}
</style>

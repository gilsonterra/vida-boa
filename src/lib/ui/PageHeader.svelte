<script lang="ts">
	import { ChevronLeft } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** Link de volta (telas empilhadas). */
		back?: { href: string; label: string };
		subtitle?: string;
		actions?: Snippet;
	}

	let { title, back, subtitle, actions }: Props = $props();
</script>

<header class="pt-safe">
	<div class="bar">
		{#if back}
			<a href={back.href} class="back"><ChevronLeft size={20} strokeWidth={1.75} />{back.label}</a>
		{:else}
			<span></span>
		{/if}
		{#if actions}<div class="actions">{@render actions()}</div>{/if}
	</div>
	<h1>{title}</h1>
	{#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
</header>

<style>
	header {
		padding-inline: 20px;
		margin-bottom: 20px;
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 52px;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		margin-left: -6px;
		padding: 6px;
		color: var(--accent);
		font-size: 15px;
	}
	.actions {
		display: flex;
		gap: 4px;
		margin-right: -8px;
	}
	h1 {
		font-size: 36px;
		font-weight: 350;
		font-variation-settings: 'opsz' 96;
		letter-spacing: -0.02em;
	}
	.subtitle {
		margin-top: 6px;
		color: var(--ink-2);
		max-width: 46ch;
	}
</style>

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
		{/if}
	</div>
	<div class="title">
		<h1>{title}</h1>
		{#if actions}<div class="actions">{@render actions()}</div>{/if}
	</div>
	{#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
</header>

<style>
	header {
		padding-inline: 20px;
		margin-bottom: 24px;
	}
	.bar {
		display: flex;
		align-items: center;
		min-height: 44px;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		margin-left: -6px;
		padding: 6px;
		color: var(--ink-2);
		font-size: 15px;
		font-weight: 500;
	}
	/* Título em pixel à esquerda e os botões redondos à direita, na mesma linha. */
	.title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 52px;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-right: -4px;
	}
	h1 {
		font-size: 38px;
		color: var(--accent);
	}
	.subtitle {
		margin-top: 8px;
		color: var(--ink-2);
		max-width: 46ch;
	}
</style>

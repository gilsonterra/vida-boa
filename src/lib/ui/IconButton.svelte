<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Botão redondo só com ícone. `hi` (tom vivo) e `strong` (acento escuro) são os pares de
	 * botões em destaque no topo das telas; `plain` é o discreto.
	 */
	interface Props {
		label: string;
		onclick?: (e: MouseEvent) => void;
		href?: string;
		tone?: 'plain' | 'hi' | 'strong';
		children: Snippet;
	}

	let { label, onclick, href, tone = 'plain', children }: Props = $props();
</script>

{#if href}
	<a {href} class="icon-btn {tone}" aria-label={label} title={label}>{@render children()}</a>
{:else}
	<button type="button" class="icon-btn {tone}" aria-label={label} title={label} {onclick}>
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
		transition:
			background-color 120ms,
			transform 120ms;
	}
	.icon-btn:active {
		transform: scale(0.94);
	}
	.plain:hover {
		background: var(--accent-soft);
	}
	.hi,
	.strong {
		width: 48px;
		height: 48px;
	}
	.hi {
		background: var(--hi);
		color: var(--on-hi);
	}
	.strong {
		background: var(--strong);
		color: var(--on-accent);
	}
</style>

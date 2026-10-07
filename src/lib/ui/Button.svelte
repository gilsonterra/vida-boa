<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'md' | 'lg' | 'sm';
		block?: boolean;
		href?: string;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		block = false,
		href,
		children,
		type = 'button',
		class: klass = '',
		...rest
	}: Props = $props();
</script>

{#if href}
	<a {href} class="btn {variant} {size} {klass}" class:block>{@render children()}</a>
{:else}
	<button {type} class="btn {variant} {size} {klass}" class:block {...rest}
		>{@render children()}</button
	>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border-radius: 999px;
		font-weight: 600;
		letter-spacing: -0.005em;
		transition:
			transform 120ms,
			background-color 120ms,
			opacity 120ms;
		user-select: none;
		white-space: nowrap;
	}
	.btn:active:not(:disabled) {
		transform: scale(0.975);
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.block {
		display: flex;
		width: 100%;
	}
	.sm {
		height: 34px;
		padding: 0 14px;
		font-size: 13px;
	}
	.md {
		height: 44px;
		padding: 0 20px;
		font-size: 15px;
	}
	.lg {
		height: 54px;
		padding: 0 26px;
		font-size: 16px;
	}
	.primary {
		background: var(--accent);
		color: var(--on-accent);
	}
	.secondary {
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow-card);
	}
	.ghost {
		background: transparent;
		color: var(--accent);
	}
	.ghost:hover {
		background: var(--accent-soft);
	}
	.danger {
		background: var(--danger-soft);
		color: var(--danger);
	}
</style>

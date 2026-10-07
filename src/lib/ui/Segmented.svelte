<script lang="ts" generics="T extends string">
	interface Props {
		options: Array<{ value: T; label: string }>;
		value: T;
		label: string;
		onchange?: (value: T) => void;
	}

	let { options, value = $bindable(), label, onchange }: Props = $props();

	const index = $derived(
		Math.max(
			0,
			options.findIndex((o) => o.value === value)
		)
	);
</script>

<div class="seg" role="radiogroup" aria-label={label} style:--n={options.length} style:--i={index}>
	<span class="thumb" aria-hidden="true"></span>
	{#each options as option (option.value)}
		<button
			type="button"
			role="radio"
			aria-checked={option.value === value}
			class:on={option.value === value}
			onclick={() => {
				value = option.value;
				onchange?.(option.value);
			}}
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	.seg {
		position: relative;
		display: grid;
		grid-template-columns: repeat(var(--n), 1fr);
		padding: 3px;
		border-radius: 999px;
		background: var(--sunken);
	}
	.thumb {
		position: absolute;
		top: 3px;
		bottom: 3px;
		left: 3px;
		width: calc((100% - 6px) / var(--n));
		transform: translateX(calc(var(--i) * 100%));
		border-radius: 999px;
		background: var(--surface);
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.08),
			0 0 0 1px var(--rule);
		transition: transform 280ms var(--ease-out-quint);
	}
	button {
		position: relative;
		height: 36px;
		font-size: 14px;
		color: var(--ink-2);
		transition: color 160ms;
	}
	button.on {
		color: var(--ink);
		font-weight: 500;
	}
	@media (prefers-reduced-motion: reduce) {
		.thumb {
			transition: none;
		}
	}
</style>

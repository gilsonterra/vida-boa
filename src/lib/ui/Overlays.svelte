<script lang="ts">
	import { fly } from 'svelte/transition';
	import { answerConfirm, dismissToast, ui } from '../stores/ui.svelte';
	import Button from './Button.svelte';
	import Sheet from './Sheet.svelte';

	/** Avisos (toasts) e diálogo de confirmação globais. */
	let confirmOpen = $derived(!!ui.confirm);
</script>

<div class="toasts" aria-live="polite">
	{#each ui.toasts as t (t.id)}
		<div class="toast" transition:fly={{ y: 16, duration: 220 }}>
			<span>{t.message}</span>
			{#if t.action}
				<button
					type="button"
					onclick={() => {
						t.action!.run();
						dismissToast(t.id);
					}}>{t.action.label}</button
				>
			{/if}
		</div>
	{/each}
</div>

{#if ui.confirm}
	<Sheet open={confirmOpen} title={ui.confirm.title} onclose={() => answerConfirm(false)}>
		<p class="msg">{ui.confirm.message}</p>
		{#snippet footer()}
			<div class="btns">
				<Button variant="secondary" onclick={() => answerConfirm(false)}>Cancelar</Button>
				<Button
					variant={ui.confirm?.destructive ? 'danger' : 'primary'}
					onclick={() => answerConfirm(true)}
				>
					{ui.confirm?.confirmLabel}
				</Button>
			</div>
		{/snippet}
	</Sheet>
{/if}

<style>
	.toasts {
		position: fixed;
		left: 50%;
		bottom: calc(96px + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		z-index: 80;
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: min(440px, calc(100vw - 32px));
		pointer-events: none;
	}
	.toast {
		pointer-events: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 13px 18px;
		border-radius: 16px;
		background: var(--ink);
		color: var(--paper);
		font-size: 14px;
		box-shadow: 0 12px 32px -8px rgb(0 0 0 / 0.35);
	}
	.toast button {
		color: var(--brass);
		font-weight: 600;
	}
	.msg {
		color: var(--ink-2);
		line-height: 1.6;
	}
	.btns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	@media (min-width: 900px) {
		.toasts {
			bottom: 28px;
		}
	}
</style>

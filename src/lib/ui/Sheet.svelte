<script lang="ts" module>
	// Contador global: várias sheets empilhadas compartilham a trava de rolagem do fundo.
	let openCount = 0;
</script>

<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { cubicOut, quintOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';

	/**
	 * Bottom sheet com cara de nativo: sobe de baixo, fecha arrastando para baixo,
	 * com Esc ou tocando fora. Em telas largas vira um diálogo centralizado.
	 */
	interface Props {
		open: boolean;
		title: string;
		onclose?: () => void;
		children: Snippet;
		footer?: Snippet;
		/** Título visível ou só para leitores de tela. */
		showTitle?: boolean;
	}

	let { open = $bindable(), title, onclose, children, footer, showTitle = true }: Props = $props();

	const titleId = `sheet-${Math.random().toString(36).slice(2, 8)}`;
	let panel = $state<HTMLDivElement>();
	let dragY = $state(0);
	let dragging = $state(false);
	let startY = 0;
	let startT = 0;

	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const wide = () => typeof matchMedia !== 'undefined' && matchMedia('(min-width: 640px)').matches;
	const ms = (n: number) => (reduced ? 0 : n);

	function close() {
		open = false;
		onclose?.();
	}

	$effect(() => {
		if (!open) return;
		const previous = document.activeElement as HTMLElement | null;
		if (openCount++ === 0) document.documentElement.style.overflow = 'hidden';
		queueMicrotask(() => {
			const first = panel?.querySelector<HTMLElement>('[autofocus], input, select, textarea');
			(wide() && first ? first : panel)?.focus({ preventScroll: true });
		});
		return () => {
			if (--openCount === 0) document.documentElement.style.overflow = '';
			previous?.focus?.({ preventScroll: true });
		};
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			close();
		}
		if (e.key === 'Tab' && panel) {
			const focusables = [
				...panel.querySelectorAll<HTMLElement>(
					'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
				)
			];
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	function onpointerdown(e: PointerEvent) {
		if (wide() || (e.target as HTMLElement).closest('button')) return;
		dragging = true;
		startY = e.clientY;
		startT = performance.now();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent) {
		if (!dragging) return;
		const dy = e.clientY - startY;
		// Resistência ao puxar para cima, livre para baixo.
		dragY = dy > 0 ? dy : dy / 6;
	}

	function onpointerup() {
		if (!dragging) return;
		dragging = false;
		const velocity = dragY / Math.max(1, performance.now() - startT);
		if (dragY > 110 || velocity > 0.6) close();
		dragY = 0;
	}

	function sheetIn(node: Element) {
		return wide()
			? fly(node, { y: 16, duration: ms(220), easing: cubicOut, opacity: 0 })
			: fly(node, { y: 520, duration: ms(420), easing: quintOut, opacity: 1 });
	}
	function sheetOut(node: Element) {
		return wide()
			? fly(node, { y: 12, duration: ms(140), easing: cubicOut, opacity: 0 })
			: fly(node, { y: 520, duration: ms(240), easing: cubicOut, opacity: 1 });
	}
</script>

{#if open}
	<div
		class="scrim"
		transition:fade={{ duration: ms(220) }}
		onclick={close}
		aria-hidden="true"
	></div>
	<div class="frame">
		<div
			bind:this={panel}
			class="sheet"
			class:dragging
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			tabindex="-1"
			style:transform={dragY ? `translateY(${dragY}px)` : undefined}
			{onkeydown}
			in:sheetIn
			out:sheetOut
		>
			<div
				class="grab"
				{onpointerdown}
				{onpointermove}
				{onpointerup}
				onpointercancel={onpointerup}
				role="presentation"
			>
				<span class="handle"></span>
				<header class:sr-only={!showTitle}>
					<h2 id={titleId}>{title}</h2>
					<button type="button" class="close" onclick={close} aria-label="Fechar">
						<X size={18} strokeWidth={1.75} />
					</button>
				</header>
			</div>
			<div class="body">
				{@render children()}
			</div>
			{#if footer}
				<footer>{@render footer()}</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: var(--scrim);
		backdrop-filter: blur(2px);
	}
	.frame {
		position: fixed;
		inset: auto 0 0 0;
		z-index: 61;
		display: flex;
		justify-content: center;
		pointer-events: none;
	}
	.sheet {
		pointer-events: auto;
		width: 100%;
		max-height: calc(100dvh - 28px - env(safe-area-inset-top));
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border-radius: 24px 24px 0 0;
		box-shadow: var(--shadow-sheet);
		transition: transform 260ms var(--ease-out-quint);
		outline: none;
	}
	.sheet.dragging {
		transition: none;
	}
	.grab {
		touch-action: none;
		padding: 8px 20px 0;
		flex-shrink: 0;
	}
	.handle {
		display: block;
		width: 36px;
		height: 4px;
		margin: 0 auto 10px;
		border-radius: 99px;
		background: var(--rule-strong);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 6px;
	}
	h2 {
		font-size: 24px;
		font-variation-settings: 'opsz' 48;
	}
	.close {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 99px;
		background: var(--sunken);
		color: var(--ink-2);
	}
	.body {
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 8px 20px 20px;
	}
	footer {
		flex-shrink: 0;
		padding: 12px 20px calc(14px + env(safe-area-inset-bottom));
		border-top: 1px solid var(--rule);
	}
	@media (min-width: 640px) {
		.frame {
			inset: 0;
			align-items: center;
			padding: 24px;
		}
		.sheet {
			max-width: 520px;
			max-height: min(760px, calc(100dvh - 48px));
			border-radius: 24px;
			box-shadow: 0 30px 80px -20px rgb(0 0 0 / 0.35);
		}
		.handle {
			display: none;
		}
		.grab {
			padding-top: 20px;
		}
		footer {
			padding-bottom: 16px;
		}
	}
</style>

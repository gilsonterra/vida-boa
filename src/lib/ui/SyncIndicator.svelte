<script lang="ts">
	import { fade } from 'svelte/transition';
	import { cloud } from '../stores/sync.svelte';

	/**
	 * Indicador discreto de sincronização: uma linha fina no topo da tela, em qualquer tela.
	 * Só aparece enquanto sincroniza, e com um pequeno atraso para não piscar em sincronizações
	 * instantâneas.
	 */
	let visible = $state(false);

	$effect(() => {
		if (cloud.status !== 'syncing') {
			visible = false;
			return;
		}
		const t = setTimeout(() => (visible = true), 250);
		return () => clearTimeout(t);
	});
</script>

{#if visible}
	<div
		class="bar"
		role="progressbar"
		aria-label="Sincronizando"
		transition:fade={{ duration: 200 }}
	>
		<span></span>
	</div>
{/if}

<style>
	.bar {
		position: fixed;
		top: env(safe-area-inset-top);
		left: 0;
		right: 0;
		z-index: 95;
		height: 2px;
		overflow: hidden;
		pointer-events: none;
	}
	span {
		position: absolute;
		inset: 0 auto 0 0;
		width: 35%;
		background: linear-gradient(90deg, transparent, var(--brass), transparent);
		animation: slide 1.1s var(--ease-out-quint) infinite;
	}
	@keyframes slide {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(300%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		span {
			width: 100%;
			animation: none;
			opacity: 0.6;
		}
	}
</style>

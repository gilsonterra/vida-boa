<script lang="ts">
	import { Gem } from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	/** Abertura com a marca, enquanto a sessão é verificada. */
	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<div
	class="splash"
	out:fade={{ duration: reduced ? 0 : 320 }}
	role="status"
	aria-label="Abrindo o Vida Boa"
>
	<div class="mark" class:still={reduced}>
		<span class="gem"><Gem size={44} strokeWidth={1.2} /></span>
		<span class="name">Vida Boa</span>
		<span class="rule" aria-hidden="true"></span>
	</div>
</div>

<style>
	.splash {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		background: var(--paper);
	}
	.mark {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	.gem {
		color: var(--brass);
		animation: rise 700ms var(--ease-out-quint) both;
	}
	.name {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 300;
		font-size: 44px;
		font-variation-settings: 'opsz' 144;
		letter-spacing: -0.02em;
		animation: rise 700ms 90ms var(--ease-out-quint) both;
	}
	/* Filete de latão que se abre: o único movimento, curto. */
	.rule {
		width: 56px;
		height: 1px;
		background: var(--brass);
		transform-origin: center;
		animation: open 800ms 220ms var(--ease-out-quint) both;
	}
	.still * {
		animation: none !important;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
	@keyframes open {
		from {
			transform: scaleX(0);
			opacity: 0;
		}
	}
</style>

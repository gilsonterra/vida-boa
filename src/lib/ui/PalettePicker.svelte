<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { PALETTES, setPalette, theme } from '../stores/theme.svelte';
	import { haptic } from '../stores/ui.svelte';

	/**
	 * Seletor de paletas. Cada amostra aplica a própria paleta via data-palette,
	 * então mostra as cores reais (no modo claro ou escuro em uso) sem depender da ativa.
	 */
</script>

<div class="grid" role="radiogroup" aria-label="Paleta de cores">
	{#each PALETTES as p (p.id)}
		<button
			type="button"
			role="radio"
			aria-checked={theme.palette === p.id}
			class="option"
			class:on={theme.palette === p.id}
			onclick={() => {
				setPalette(p.id);
				haptic();
			}}
		>
			<span class="swatch" data-palette={p.id} aria-hidden="true">
				<span class="disc"></span>
				<span class="gem"></span>
				{#if theme.palette === p.id}<span class="tick"><Check size={14} strokeWidth={2.2} /></span
					>{/if}
			</span>
			<span class="name">{p.name}</span>
			<span class="about">{p.color}. {p.about}.</span>
		</button>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 10px;
	}
	.option {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 10px 10px 14px;
		border-radius: 18px;
		text-align: left;
		box-shadow: inset 0 0 0 1px var(--rule);
		transition: box-shadow 160ms;
	}
	.option.on {
		box-shadow: inset 0 0 0 1.5px var(--accent);
	}
	/* Amostra: papel da paleta, disco no acento e um ponto de latão. */
	.swatch {
		--sw-paper: var(--l-paper);
		--sw-accent: var(--l-accent);
		--sw-on: var(--l-on-accent);
		--sw-brass: var(--l-brass);
		position: relative;
		display: block;
		width: 100%;
		height: 64px;
		margin-bottom: 10px;
		border-radius: 12px;
		background: var(--sw-paper);
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.06);
		overflow: hidden;
	}
	:global(:root[data-theme='dark']) .swatch {
		--sw-paper: var(--d-paper);
		--sw-accent: var(--d-accent);
		--sw-on: var(--d-on-accent);
		--sw-brass: var(--d-brass);
	}
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .swatch {
			--sw-paper: var(--d-paper);
			--sw-accent: var(--d-accent);
			--sw-on: var(--d-on-accent);
			--sw-brass: var(--d-brass);
		}
	}
	.disc {
		position: absolute;
		right: -14px;
		bottom: -22px;
		width: 78px;
		height: 78px;
		border-radius: 99px;
		background: var(--sw-accent);
	}
	.gem {
		position: absolute;
		left: 14px;
		top: 14px;
		width: 10px;
		height: 10px;
		transform: rotate(45deg);
		background: var(--sw-brass);
	}
	.tick {
		position: absolute;
		right: 10px;
		bottom: 9px;
		display: grid;
		place-items: center;
		color: var(--sw-on);
	}
	.name {
		font-family: var(--font-serif);
		font-size: 18px;
		font-variation-settings: 'opsz' 36;
	}
	.about {
		font-size: 12.5px;
		line-height: 1.35;
		color: var(--ink-2);
	}
</style>

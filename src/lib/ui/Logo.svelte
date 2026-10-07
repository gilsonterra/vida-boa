<script lang="ts" module>
	const PIXELS = `<path fill="#ffb627" d="M16 3h1v1h-1zM14 4h1v1h-1zM18 4h1v1h-1zM13 6h1v1h-1zM19 6h1v1h-1zM14 8h1v1h-1zM18 8h1v1h-1zM16 9h1v1h-1z"/><path fill="#ffd23f" d="M15 4h3v1h-3zM14 5h5v1h-5zM14 6h5v1h-5zM14 7h5v1h-5zM15 8h3v1h-3z"/><path fill="#8fd468" d="M25 6h2v1h-2zM4 7h2v1h-2zM22 7h2v1h-2zM29 7h2v1h-2zM0 8h2v1h-2zM7 8h2v1h-2zM21 8h2v1h-2zM30 8h2v1h-2zM0 9h1v1h-1zM8 9h2v1h-2zM20 9h2v1h-2zM31 9h1v1h-1zM9 10h2v1h-2zM20 10h1v1h-1zM10 11h1v1h-1z"/><path fill="#3fa34d" d="M24 7h5v1h-5zM2 8h5v1h-5zM23 8h3v1h-3zM28 8h2v1h-2zM1 9h3v1h-3zM6 9h2v1h-2zM22 9h1v1h-1zM24 9h1v1h-1zM28 9h1v1h-1zM30 9h1v1h-1zM0 10h1v1h-1zM2 10h1v1h-1zM6 10h1v1h-1zM8 10h1v1h-1zM21 10h1v1h-1zM23 10h1v1h-1zM29 10h1v1h-1zM31 10h1v1h-1zM1 11h1v1h-1zM7 11h1v1h-1zM9 11h1v1h-1zM20 11h1v1h-1zM23 11h1v1h-1zM29 11h1v1h-1zM1 12h1v1h-1zM7 12h1v1h-1zM10 12h1v1h-1z"/><path fill="#1f6b3a" d="M26 8h2v1h-2zM4 9h2v1h-2zM23 9h1v1h-1zM29 9h1v1h-1zM1 10h1v1h-1zM7 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM28 10h1v1h-1zM30 10h1v1h-1zM0 11h1v1h-1zM2 11h1v1h-1zM6 11h1v1h-1zM8 11h1v1h-1zM21 11h2v1h-2zM30 11h2v1h-2zM0 12h1v1h-1zM8 12h2v1h-2zM23 12h1v1h-1zM29 12h1v1h-1zM1 13h1v1h-1zM7 13h1v1h-1z"/><path fill="#4a2a10" d="M25 9h1v1h-1zM27 9h1v1h-1zM3 10h1v1h-1zM5 10h1v1h-1zM26 10h1v1h-1zM4 11h1v1h-1z"/><path fill="#6b3f1d" d="M26 9h1v1h-1zM4 10h1v1h-1zM25 11h1v1h-1zM5 12h2v1h-2zM25 12h2v1h-2zM5 13h1v1h-1zM25 13h1v1h-1zM5 14h1v1h-1zM24 14h1v1h-1zM6 15h1v1h-1zM25 15h1v1h-1zM6 16h1v1h-1zM24 16h1v1h-1zM6 17h1v1h-1zM24 17h1v1h-1zM6 18h2v1h-2zM24 18h2v1h-2zM6 19h1v1h-1zM24 19h1v1h-1zM7 20h1v1h-1zM23 20h1v1h-1zM7 21h2v1h-2zM23 21h2v1h-2zM7 22h1v1h-1zM23 22h1v1h-1zM7 23h1v1h-1zM23 23h1v1h-1zM6 24h2v1h-2zM24 24h2v1h-2zM6 25h1v1h-1zM24 25h1v1h-1zM6 26h1v1h-1zM24 26h1v1h-1zM6 27h2v1h-2zM24 27h2v1h-2z"/><path fill="#a8692f" d="M27 10h1v1h-1zM6 13h1v1h-1zM26 13h1v1h-1zM7 16h1v1h-1zM25 16h1v1h-1zM7 19h1v1h-1zM25 19h1v1h-1zM8 22h1v1h-1zM24 22h1v1h-1zM7 25h1v1h-1zM25 25h1v1h-1z"/><path fill="#d29a55" d="M5 11h1v1h-1zM26 11h1v1h-1zM6 14h1v1h-1zM25 14h1v1h-1zM7 17h1v1h-1zM25 17h1v1h-1zM8 20h1v1h-1zM24 20h1v1h-1zM8 23h1v1h-1zM24 23h1v1h-1zM7 26h1v1h-1zM25 26h1v1h-1z"/><path fill="#7a4a1f" d="M11 14h2v1h-2zM10 15h4v1h-4z"/><path fill="#e9d8a6" d="M7 15h1v1h-1zM24 15h1v1h-1zM8 16h2v1h-2zM22 16h2v1h-2z"/><path fill="#f1b98a" d="M21 15h1v1h-1zM11 16h1v1h-1zM20 16h1v1h-1zM11 17h2v1h-2zM20 17h1v1h-1z"/><path fill="#2b2b2b" d="M12 16h1v1h-1z"/><path fill="#ffe08a" d="M10 17h1v1h-1zM20 18h1v1h-1zM12 19h1v1h-1zM18 20h1v1h-1zM14 21h1v1h-1zM16 21h1v1h-1z"/><path fill="#f08a3c" d="M21 17h1v1h-1zM11 18h1v1h-1zM19 19h1v1h-1zM13 20h1v1h-1zM15 21h1v1h-1zM17 21h1v1h-1zM15 23h1v1h-1zM17 23h1v1h-1z"/><path fill="#c8402f" d="M10 18h1v1h-1zM21 18h1v1h-1zM11 19h1v1h-1zM20 19h1v1h-1zM11 20h2v1h-2zM19 20h2v1h-2zM12 21h2v1h-2zM18 21h2v1h-2zM13 22h6v1h-6zM14 23h1v1h-1zM16 23h1v1h-1z"/><path fill="#2f6fd0" d="M13 18h2v1h-2zM13 19h3v1h-3zM14 20h3v1h-3z"/><path fill="#1f4f9e" d="M19 18h1v1h-1zM17 19h2v1h-2zM17 20h1v1h-1z"/><path fill="#f3d98b" d="M4 27h2v1h-2zM8 27h16v1h-16zM26 27h2v1h-2zM0 28h11v1h-11zM12 28h9v1h-9zM22 28h10v1h-10zM0 29h5v1h-5zM6 29h8v1h-8zM15 29h9v1h-9zM25 29h7v1h-7zM0 30h9v1h-9zM10 30h9v1h-9zM20 30h7v1h-7zM28 30h4v1h-4zM0 31h32v1h-32z"/><path fill="#d8b55e" d="M11 28h1v1h-1zM21 28h1v1h-1zM5 29h1v1h-1zM14 29h1v1h-1zM24 29h1v1h-1zM9 30h1v1h-1zM19 30h1v1h-1zM27 30h1v1h-1z"/>`;
</script>

<script lang="ts">
	/**
	 * Marca do Vida Boa: coqueiros com uma rede, em pixel art 32×32 (estilo jogo 2D antigo).
	 * As cores são da própria marca, não do tema; o favicon e os ícones do app usam o mesmo
	 * desenho sobre o céu.
	 */
	let { size = 32 }: { size?: number } = $props();
</script>

<svg
	class="logo"
	width={size}
	height={size}
	viewBox="0 0 32 32"
	shape-rendering="crispEdges"
	aria-hidden="true">{@html PIXELS}</svg
>

<style>
	.logo {
		flex-shrink: 0;
		image-rendering: pixelated;
	}
</style>

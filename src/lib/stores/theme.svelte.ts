export type ThemePref = 'system' | 'light' | 'dark';

/** Paletas de cor, com nomes de deuses gregos. A ordem é a do seletor em Ajustes. */
export const PALETTES = [
	{ id: 'demeter', name: 'Deméter', color: 'Verde', about: 'Deusa da colheita e da fartura' },
	{ id: 'afrodite', name: 'Afrodite', color: 'Rosa', about: 'Deusa do amor e da beleza' },
	{ id: 'poseidon', name: 'Poseidon', color: 'Azul', about: 'Deus dos mares' },
	{ id: 'dionisio', name: 'Dionísio', color: 'Roxo', about: 'Deus do vinho e das festas' },
	{ id: 'hestia', name: 'Héstia', color: 'Marrom', about: 'Deusa do lar e da lareira' },
	{ id: 'apolo', name: 'Apolo', color: 'Laranja', about: 'Deus do sol e das artes' }
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

const THEME_KEY = 'vb:theme';
const PALETTE_KEY = 'vb:palette';

function readTheme(): ThemePref {
	try {
		const v = localStorage.getItem(THEME_KEY);
		return v === 'light' || v === 'dark' ? v : 'system';
	} catch {
		return 'system';
	}
}

function readPalette(): PaletteId {
	try {
		const v = localStorage.getItem(PALETTE_KEY);
		return PALETTES.some((p) => p.id === v) ? (v as PaletteId) : 'demeter';
	} catch {
		return 'demeter';
	}
}

function save(key: string, value: string | null) {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		/* armazenamento indisponível: vale só nesta sessão */
	}
}

export const theme = $state({ pref: 'system' as ThemePref, palette: 'demeter' as PaletteId });

export function initTheme() {
	theme.pref = readTheme();
	theme.palette = readPalette();
	apply();
	matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
}

export function setTheme(pref: ThemePref) {
	theme.pref = pref;
	save(THEME_KEY, pref === 'system' ? null : pref);
	apply();
}

export function setPalette(palette: PaletteId) {
	theme.palette = palette;
	save(PALETTE_KEY, palette === 'demeter' ? null : palette);
	apply();
}

function apply() {
	const root = document.documentElement;
	if (theme.pref === 'system') delete root.dataset.theme;
	else root.dataset.theme = theme.pref;
	root.dataset.palette = theme.palette;
	// Mantém a barra de status do sistema na cor do papel.
	const bg = getComputedStyle(root).getPropertyValue('--paper').trim();
	document
		.querySelectorAll('meta[name="theme-color"]')
		.forEach((m) => m.setAttribute('content', bg));
}

// Aplica tema e paleta antes da primeira pintura, para não piscar.
// Fica num arquivo (e não embutido no HTML) para a Content Security Policy poder
// proibir scripts embutidos.
try {
	const t = localStorage.getItem('vb:theme');
	if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
	const p = localStorage.getItem('vb:palette');
	if (p && /^[a-z]+$/.test(p)) document.documentElement.dataset.palette = p;
} catch {
	/* armazenamento indisponível */
}

import type { Action } from 'svelte/action';

/**
 * Arrastar com o mouse para rolar na horizontal (carrosséis, filas de filtros). No toque o
 * navegador já faz isso; aqui só o mouse é tratado. Durante o arrasto o encaixe (scroll-snap)
 * fica desligado, para o movimento seguir o cursor, e volta ao soltar. Um arrasto de verdade
 * não vira clique no cartão em que o mouse foi solto.
 */
export const dragScroll: Action<HTMLElement> = (node) => {
	const THRESHOLD = 5;
	let startX = 0;
	let startLeft = 0;
	let pointerId: number | null = null;
	let dragged = false;

	function down(e: PointerEvent) {
		if (e.pointerType !== 'mouse' || e.button !== 0) return;
		if (node.scrollWidth <= node.clientWidth) return;
		pointerId = e.pointerId;
		startX = e.clientX;
		startLeft = node.scrollLeft;
		dragged = false;
	}

	function move(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		const dx = e.clientX - startX;
		if (!dragged) {
			if (Math.abs(dx) < THRESHOLD) return;
			dragged = true;
			node.setPointerCapture(e.pointerId);
			node.style.scrollSnapType = 'none';
			node.style.cursor = 'grabbing';
			node.style.userSelect = 'none';
		}
		node.scrollLeft = startLeft - dx;
	}

	function up(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		pointerId = null;
		if (!dragged) return;
		if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
		node.style.cursor = '';
		node.style.userSelect = '';
		// Devolve o encaixe a partir da posição atual: o navegador alinha no cartão mais próximo.
		const left = node.scrollLeft;
		node.style.scrollSnapType = '';
		node.scrollLeft = left;
	}

	/** Engole o clique que encerra um arrasto (senão soltar sobre um cartão o abriria). */
	function click(e: MouseEvent) {
		if (!dragged) return;
		dragged = false;
		e.preventDefault();
		e.stopPropagation();
	}

	/** Também impede o arrasto nativo de links e imagens, que roubaria o gesto. */
	function dragstart(e: DragEvent) {
		e.preventDefault();
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', up);
	node.addEventListener('pointercancel', up);
	node.addEventListener('click', click, true);
	node.addEventListener('dragstart', dragstart);
	node.style.cursor = 'grab';

	return {
		destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', up);
			node.removeEventListener('click', click, true);
			node.removeEventListener('dragstart', dragstart);
		}
	};
};

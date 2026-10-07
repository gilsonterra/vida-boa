/**
 * Dinheiro é sempre tratado em centavos inteiros. A conversão a partir de texto
 * é feita sobre a string, nunca via float, para não introduzir erros de arredondamento.
 */

/**
 * Converte um valor textual em centavos. Aceita formatos de OFX e de digitação:
 * `-1234.5`, `1.234,56`, `1234,56`, `R$ 10`, `+0.99`.
 * Retorna `null` se o texto não representar um número.
 */
export function parseAmountToCents(
	input: string,
	opts: { dotIsDecimal?: boolean } = {}
): number | null {
	let s = input
		.trim()
		.replace(/R\$\s?/i, '')
		.replace(/\s/g, '');
	if (!s) return null;

	let negative = false;
	if (s.startsWith('-')) {
		negative = true;
		s = s.slice(1);
	} else if (s.startsWith('+')) {
		s = s.slice(1);
	}

	const lastComma = s.lastIndexOf(',');
	const lastDot = s.lastIndexOf('.');
	let intPart: string;
	let fracPart = '';

	if (lastComma === -1 && lastDot === -1) {
		intPart = s;
	} else {
		// O separador decimal é o último que aparece; o outro é separador de milhar.
		const decimalSep = lastComma > lastDot ? ',' : '.';
		const thousandSep = decimalSep === ',' ? '.' : ',';
		const idx = s.lastIndexOf(decimalSep);
		const tail = s.slice(idx + 1);
		const onlyOneSep = !s.slice(0, idx).includes(decimalSep);
		// Na digitação, "1.234" (sem vírgula) é milhar. No OFX o ponto é sempre decimal.
		const looksLikeThousands =
			!opts.dotIsDecimal &&
			decimalSep === '.' &&
			lastComma === -1 &&
			tail.length === 3 &&
			onlyOneSep &&
			idx > 0;
		if (looksLikeThousands) {
			intPart = s.replaceAll('.', '');
		} else {
			intPart = s.slice(0, idx).replaceAll(thousandSep, '');
			fracPart = tail;
		}
	}

	if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart) || (intPart + fracPart).length === 0) {
		return null;
	}

	// Arredonda meio centavo para cima (padrão bancário simples).
	const frac3 = (fracPart + '000').slice(0, 3);
	let cents = Number(intPart || '0') * 100 + Number(frac3.slice(0, 2));
	if (Number(frac3[2]) >= 5) cents += 1;

	return negative && cents !== 0 ? -cents : cents;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRL',
	notation: 'compact',
	maximumFractionDigits: 1
});
const plain = new Intl.NumberFormat('pt-BR', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

/** `-123456` → `-R$ 1.234,56` */
export function formatCents(cents: number, opts: { signed?: boolean } = {}): string {
	const formatted = brl.format(cents / 100).replace(/ /g, ' ');
	if (opts.signed && cents > 0) return '+' + formatted;
	return formatted;
}

/** `123456789` → `R$ 1,2 mi` */
export function formatCentsCompact(cents: number): string {
	return brlCompact.format(cents / 100).replace(/ /g, ' ');
}

/** `123456` → `1.234,56` (para preencher campos de edição). */
export function centsToInput(cents: number): string {
	return plain.format(Math.abs(cents) / 100);
}

export function sumCents(values: Iterable<number>): number {
	let total = 0;
	for (const v of values) total += v;
	return total;
}

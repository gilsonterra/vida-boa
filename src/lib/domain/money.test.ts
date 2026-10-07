import { describe, expect, it } from 'vitest';
import { centsToInput, formatCents, parseAmountToCents } from './money';

describe('parseAmountToCents', () => {
	it.each([
		['-1234.50', -123450],
		['1234,56', 123456],
		['1.234,56', 123456],
		['R$ 10', 1000],
		['+0.99', 99],
		['0,1', 10],
		['1.234', 123400],
		['12,345', 1235],
		['-0.00', 0],
		['  -45.9 ', -4590]
	])('%s → %i', (input, expected) => {
		expect(parseAmountToCents(input)).toBe(expected);
	});

	it('trata ponto como decimal no modo OFX', () => {
		expect(parseAmountToCents('1.500', { dotIsDecimal: true })).toBe(150);
		expect(parseAmountToCents('-12.345', { dotIsDecimal: true })).toBe(-1235);
	});

	it('não sofre erro de ponto flutuante', () => {
		expect(parseAmountToCents('0.29', { dotIsDecimal: true })).toBe(29);
		expect(parseAmountToCents('1.15', { dotIsDecimal: true })).toBe(115);
	});

	it.each(['', 'abc', '1,2,3x', '-'])('rejeita %j', (input) => {
		expect(parseAmountToCents(input)).toBeNull();
	});
});

describe('formatação', () => {
	it('formata em reais', () => {
		expect(formatCents(-123456)).toBe('-R$ 1.234,56');
		expect(formatCents(500, { signed: true })).toBe('+R$ 5,00');
		expect(centsToInput(-123456)).toBe('1.234,56');
	});
});

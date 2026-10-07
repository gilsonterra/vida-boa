import { describe, expect, it } from 'vitest';
import { addMonths, formatMonth, monthRange, monthsBetween, nextOccurrence } from './dates';
import { dueOccurrences } from './recurrence';

describe('datas', () => {
	it('soma meses respeitando o fim do mês', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
		expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
	});

	it('mantém o dia âncora depois de um mês curto', () => {
		const feb = nextOccurrence('2026-01-31', 'monthly', '2026-01-31');
		expect(feb).toBe('2026-02-28');
		expect(nextOccurrence(feb, 'monthly', '2026-01-31')).toBe('2026-03-31');
	});

	it('calcula intervalo e lista de meses', () => {
		expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
		expect(monthsBetween('2025-11', '2026-02')).toEqual([
			'2025-11',
			'2025-12',
			'2026-01',
			'2026-02'
		]);
		expect(formatMonth('2026-10')).toBe('Outubro de 2026');
	});
});

describe('recorrência', () => {
	const rule = {
		startDate: '2026-07-05',
		nextDate: '2026-07-05',
		endDate: null,
		frequency: 'monthly' as const,
		active: true
	};

	it('gera as ocorrências vencidas e aponta a próxima', () => {
		expect(dueOccurrences(rule, '2026-10-06')).toEqual({
			dates: ['2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05'],
			nextDate: '2026-11-05'
		});
	});

	it('respeita data final e regra inativa', () => {
		expect(dueOccurrences({ ...rule, endDate: '2026-08-31' }, '2026-10-06').dates).toHaveLength(2);
		expect(dueOccurrences({ ...rule, active: false }, '2026-10-06').dates).toHaveLength(0);
	});
});

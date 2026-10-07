import { describe, expect, it } from 'vitest';
import { buildSchedule, monthlyRate, outstandingAt } from './loans';
import type { Loan, LoanPrepayment } from './types';

function loan(over: Partial<Loan> = {}): Loan {
	return {
		id: 'loan-1',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		deletedAt: null,
		name: 'Casa',
		kind: 'home',
		mode: 'contract',
		system: 'price',
		principalCents: 10_000_000,
		ratePercent: 1,
		ratePeriod: 'month',
		installmentCents: 0,
		termMonths: 12,
		firstDueDate: '2026-01-10',
		paidBefore: 0,
		accountId: 'acc-1',
		categoryId: null,
		...over
	};
}

function prepay(over: Partial<LoanPrepayment>): LoanPrepayment {
	return {
		id: 'pre-1',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		deletedAt: null,
		loanId: 'loan-1',
		date: '2026-06-20',
		amountCents: 2_000_000,
		effect: 'term',
		accountId: 'acc-1',
		...over
	};
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe('taxa', () => {
	it('converte a taxa anual efetiva para mensal', () => {
		expect(monthlyRate(12.682503, 'year')).toBeCloseTo(0.01, 6);
		expect(monthlyRate(1, 'month')).toBe(0.01);
	});
});

describe('tabela Price', () => {
	const s = buildSchedule(loan(), []);

	it('tem parcela fixa e quita o saldo na última', () => {
		expect(s.installments).toHaveLength(12);
		expect(s.installments[0].paymentCents).toBe(888_488);
		expect(s.installments[10].paymentCents).toBe(888_488);
		expect(s.installments.at(-1)!.balanceCents).toBe(0);
		expect(sum(s.installments.map((i) => i.amortizationCents))).toBe(10_000_000);
	});

	it('separa juros e amortização a cada mês', () => {
		const first = s.installments[0];
		expect(first.interestCents).toBe(100_000);
		expect(first.amortizationCents).toBe(788_488);
		expect(first.balanceCents).toBe(10_000_000 - 788_488);
		expect(s.totalInterestCents).toBe(sum(s.installments.map((i) => i.interestCents)));
	});

	it('vence no mesmo dia de cada mês', () => {
		expect(s.installments.slice(0, 3).map((i) => i.dueDate)).toEqual([
			'2026-01-10',
			'2026-02-10',
			'2026-03-10'
		]);
	});
});

describe('tabela SAC', () => {
	const s = buildSchedule(loan({ system: 'sac', principalCents: 12_000_000 }), []);

	it('amortiza o mesmo valor e a parcela cai a cada mês', () => {
		expect(s.installments.every((i) => i.amortizationCents === 1_000_000)).toBe(true);
		expect(s.installments[0].paymentCents).toBe(1_120_000);
		expect(s.installments.at(-1)!.paymentCents).toBe(1_010_000);
		expect(s.totalInterestCents).toBe(780_000);
	});
});

describe('modo simples', () => {
	const s = buildSchedule(loan({ mode: 'simple', installmentCents: 50_000, termMonths: 10 }), []);

	it('é parcela × quantidade, sem juros', () => {
		expect(s.principalCents).toBe(500_000);
		expect(s.installments).toHaveLength(10);
		expect(s.installments.every((i) => i.paymentCents === 50_000 && i.interestCents === 0)).toBe(
			true
		);
	});
});

describe('amortização extra', () => {
	const base = buildSchedule(loan(), []);

	it('reduzindo o prazo, mantém a parcela e termina antes', () => {
		const s = buildSchedule(loan(), [prepay({ effect: 'term' })]);
		expect(s.installments.length).toBeLessThan(12);
		expect(s.installments[6].paymentCents).toBe(888_488);
		expect(s.installments.at(-1)!.balanceCents).toBe(0);
		expect(s.prepayments[0]).toMatchObject({ afterInstallment: 6, appliedCents: 2_000_000 });
		expect(s.totalInterestCents).toBeLessThan(base.totalInterestCents);
	});

	it('reduzindo a parcela, mantém o prazo e baixa o valor', () => {
		const s = buildSchedule(loan(), [prepay({ effect: 'installment' })]);
		expect(s.installments).toHaveLength(12);
		expect(s.installments[6].paymentCents).toBeLessThan(888_488);
		expect(s.installments[7].paymentCents).toBe(s.installments[6].paymentCents);
		expect(s.installments.at(-1)!.balanceCents).toBe(0);
	});

	it('não abate mais do que o saldo', () => {
		const s = buildSchedule(loan(), [prepay({ amountCents: 999_999_999 })]);
		expect(s.installments).toHaveLength(6);
		expect(s.prepayments[0].appliedCents).toBe(s.installments[5].balanceCents);
	});

	it('ignora amortizações excluídas', () => {
		const s = buildSchedule(loan(), [prepay({ deletedAt: '2026-07-01T00:00:00.000Z' })]);
		expect(s.installments).toHaveLength(12);
	});
});

describe('saldo devedor numa data', () => {
	const s = buildSchedule(loan(), [prepay({ date: '2026-03-15' })]);

	it('é zero antes do contrato e o valor cheio no início', () => {
		expect(outstandingAt(s, '2025-11-30')).toBe(0);
		expect(outstandingAt(s, '2026-01-05')).toBe(10_000_000);
	});

	it('desconta parcelas vencidas e amortizações feitas até a data', () => {
		const [a, b] = s.installments;
		expect(outstandingAt(s, '2026-02-10')).toBe(
			10_000_000 - a.amortizationCents - b.amortizationCents
		);
		expect(outstandingAt(s, '2026-03-15')).toBe(s.installments[2].balanceCents - 2_000_000);
		expect(outstandingAt(s, '2030-01-01')).toBe(0);
	});
});

import { describe, expect, it } from 'vitest';
import {
	defaultConsolidated,
	entriesBetween,
	flows,
	isConsolidated,
	paidInstallments,
	pendingUpTo,
	sumEntries,
	withInstallmentStatus
} from './ledger';
import { buildSchedule, outstandingAt } from './loans';
import { accountBalances, netWorthSeries, summarize } from './reports';
import type { Account, Loan, RecurringRule, Transaction } from './types';

const base = {
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	deletedAt: null
};

const account: Account = {
	...base,
	id: 'acc-1',
	name: 'Corrente',
	typeId: 't',
	institution: '',
	color: '#000',
	initialBalanceCents: 100_000,
	currency: 'BRL',
	archived: false,
	ofxBankId: null,
	ofxAccountId: null
};

function tx(id: string, date: string, amountCents: number, consolidated = true): Transaction {
	return {
		...base,
		id,
		accountId: 'acc-1',
		date,
		amountCents,
		description: id,
		notes: '',
		kind: amountCents < 0 ? 'expense' : 'income',
		categoryId: null,
		transferId: null,
		fitId: null,
		importBatchId: null,
		recurringId: null,
		consolidated
	};
}

const rule: RecurringRule = {
	...base,
	id: 'rule-1',
	description: 'Aluguel',
	accountId: 'acc-1',
	categoryId: null,
	kind: 'expense',
	amountCents: 50_000,
	frequency: 'monthly',
	startDate: '2026-01-15',
	endDate: null,
	nextDate: '2026-10-15',
	active: true
};

const loan: Loan = {
	...base,
	id: 'loan-1',
	name: 'Carro',
	kind: 'vehicle',
	mode: 'simple',
	system: 'price',
	principalCents: 0,
	ratePercent: 0,
	ratePeriod: 'month',
	installmentCents: 30_000,
	termMonths: 12,
	firstDueDate: '2026-01-20',
	paidBefore: 2,
	installmentStatus: { 3: true, 11: true }
};

describe('regra: só o consolidado conta, a data não importa', () => {
	const txs = [
		tx('feito', '2026-10-01', -10_000),
		tx('pendente-atrasado', '2026-10-02', -5_000, false),
		tx('futuro-consolidado', '2026-12-20', -20_000),
		tx('futuro-pendente', '2026-12-21', -7_000, false)
	];

	it('saldo da conta', () => {
		expect(accountBalances([account], txs).get('acc-1')).toBe(70_000);
	});

	it('resumo do mês', () => {
		expect(summarize(txs.slice(0, 2)).expenseCents).toBe(10_000);
	});

	it('gráfico fecha com o saldo atual', () => {
		const series = netWorthSeries([account], txs, ['2026-09', '2026-10']);
		expect(series.map((p) => p.totalCents)).toEqual([100_000, 70_000]);
	});

	it('transferência é sempre consolidada', () => {
		const t = { ...tx('t', '2026-10-01', -1), kind: 'transfer' as const, consolidated: false };
		expect(isConsolidated(t)).toBe(true);
	});

	it('padrão ao criar: consolidado, a não ser que a data seja futura', () => {
		expect(defaultConsolidated('2026-10-08', '2026-10-08')).toBe(true);
		expect(defaultConsolidated('2026-10-09', '2026-10-08')).toBe(false);
	});
});

describe('parcelas de financiamento', () => {
	const schedule = buildSchedule(loan, []);

	it('pagas são as de antes do app e as consolidadas, seja qual for o vencimento', () => {
		expect([...paidInstallments(loan, schedule)].sort((a, b) => a - b)).toEqual([1, 2, 3, 11]);
	});

	it('só as pagas abatem a dívida', () => {
		const paid = paidInstallments(loan, schedule);
		expect(outstandingAt(schedule, '2026-10-08', paid)).toBe(360_000 - 4 * 30_000);
	});

	it('marcar e desmarcar', () => {
		expect(withInstallmentStatus(loan, 4, true)).toEqual({ 3: true, 4: true, 11: true });
		expect(withInstallmentStatus(loan, 3, false)).toEqual({ 11: true });
	});
});

describe('lista do extrato e previsão', () => {
	const input = {
		transactions: [tx('feito', '2026-10-01', -10_000), tx('pend', '2026-09-30', -5_000, false)],
		recurring: [rule],
		loans: [loan],
		schedules: new Map([[loan.id, buildSchedule(loan, [])]]),
		accountIds: null
	};

	it('o mês junta lançamentos, parcelas e recorrências previstas', () => {
		const items = entriesBetween(input, '2026-10-01', '2026-10-31');
		expect(items.map((e) => [e.source, e.date, e.consolidated])).toEqual([
			['transaction', '2026-10-01', true],
			['recurring', '2026-10-15', null],
			['installment', '2026-10-20', false]
		]);
	});

	it('previsão: pendentes atrasados, parcelas pendentes e recorrências até a data', () => {
		const items = pendingUpTo(input, '2026-10-31');
		// Parcelas 4 a 10 pendentes (3 e 11 consolidadas), lançamento atrasado e o aluguel.
		expect(items.filter((e) => e.source === 'installment')).toHaveLength(7);
		expect(items.some((e) => e.key === 't:pend')).toBe(true);
		expect(sumEntries(items)).toBe(-7 * 30_000 - 5_000 - 50_000);
	});

	it('entradas e saídas sem transferências', () => {
		const items = entriesBetween(input, '2026-10-01', '2026-10-31');
		expect(flows(items)).toEqual({ incomeCents: 0, expenseCents: 90_000 });
	});
});

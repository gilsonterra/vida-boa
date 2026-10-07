import { addMonths } from './dates';
import { stableUuid } from './ids';
import type { ID, ISODate, Loan, LoanPrepayment, PrepaymentEffect } from './types';

/**
 * Tabela de um financiamento, calculada a partir do contrato e das amortizações extras.
 * Nada disso é gravado: a tabela é sempre refeita, então mudar o contrato ou registrar uma
 * amortização recalcula tudo sem reescrever parcelas (e sem conflitos entre aparelhos).
 * Valores em centavos; o arredondamento de cada mês é absorvido pela última parcela.
 */

/** Proteção contra contratos impossíveis (parcela menor que os juros nunca quita). */
const MAX_INSTALLMENTS = 600;

export interface Installment {
	n: number;
	dueDate: ISODate;
	paymentCents: number;
	interestCents: number;
	amortizationCents: number;
	/** Saldo devedor logo depois desta parcela. */
	balanceCents: number;
}

export interface AppliedPrepayment {
	id: ID;
	date: ISODate;
	effect: PrepaymentEffect;
	/** O que de fato abateu (nunca mais que o saldo). */
	appliedCents: number;
	/** Número da última parcela vencida antes dela (0 = antes da primeira). */
	afterInstallment: number;
}

export interface LoanSchedule {
	principalCents: number;
	/** Um mês antes da primeira parcela: antes disso, não há dívida. */
	startDate: ISODate;
	installments: Installment[];
	prepayments: AppliedPrepayment[];
	totalInterestCents: number;
	totalPaidCents: number;
}

/** Taxa mensal (fração). A anual é tratada como efetiva: (1 + a)^(1/12) − 1. */
export function monthlyRate(ratePercent: number, period: 'month' | 'year'): number {
	const r = ratePercent / 100;
	return period === 'month' ? r : Math.pow(1 + r, 1 / 12) - 1;
}

/** No modo simples, o "valor financiado" é a soma das parcelas. */
export function loanPrincipal(loan: Loan): number {
	return loan.mode === 'simple' ? loan.installmentCents * loan.termMonths : loan.principalCents;
}

export function dueDateOf(loan: Loan, n: number): ISODate {
	return addMonths(loan.firstDueDate, n - 1, Number(loan.firstDueDate.slice(8, 10)));
}

function pricePayment(balance: number, rate: number, count: number): number {
	if (count <= 0) return balance;
	if (rate === 0) return Math.round(balance / count);
	return Math.round((balance * rate) / (1 - Math.pow(1 + rate, -count)));
}

export function buildSchedule(loan: Loan, prepayments: LoanPrepayment[]): LoanSchedule {
	const rate = loan.mode === 'simple' ? 0 : monthlyRate(loan.ratePercent, loan.ratePeriod);
	const system = loan.mode === 'simple' ? 'price' : loan.system;
	const principalCents = loanPrincipal(loan);
	const pending = prepayments
		.filter((p) => !p.deletedAt && p.loanId === loan.id && p.amountCents > 0)
		.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

	let balance = principalCents;
	let remaining = loan.termMonths;
	let payment = pricePayment(balance, rate, remaining);
	let amortization = Math.round(balance / Math.max(remaining, 1));
	const installments: Installment[] = [];
	const applied: AppliedPrepayment[] = [];
	let next = 0;

	for (let n = 1; balance > 0 && n <= MAX_INSTALLMENTS; n++) {
		const dueDate = dueDateOf(loan, n);
		// Amortizações feitas antes deste vencimento abatem o saldo que gera os juros dele.
		while (next < pending.length && pending[next].date < dueDate && balance > 0) {
			const p = pending[next++];
			const cents = Math.min(p.amountCents, balance);
			balance -= cents;
			applied.push({
				id: p.id,
				date: p.date,
				effect: p.effect,
				appliedCents: cents,
				afterInstallment: n - 1
			});
			// "Reduzir parcela": mesmo prazo restante, parcela recalculada sobre o saldo novo.
			// "Reduzir prazo": a parcela continua igual e o saldo acaba antes.
			if (p.effect === 'installment') {
				payment = pricePayment(balance, rate, remaining);
				amortization = Math.round(balance / Math.max(remaining, 1));
			}
		}
		if (balance <= 0) break;

		const interest = Math.round(balance * rate);
		let amort = system === 'price' ? payment - interest : amortization;
		if (remaining <= 1 || amort >= balance) amort = balance;
		amort = Math.max(amort, 0);
		balance -= amort;
		remaining--;
		installments.push({
			n,
			dueDate,
			paymentCents: amort + interest,
			interestCents: interest,
			amortizationCents: amort,
			balanceCents: balance
		});
	}

	const totalInterestCents = installments.reduce((s, i) => s + i.interestCents, 0);
	return {
		principalCents,
		startDate: addMonths(loan.firstDueDate, -1),
		installments,
		prepayments: applied,
		totalInterestCents,
		totalPaidCents:
			installments.reduce((s, i) => s + i.paymentCents, 0) +
			applied.reduce((s, p) => s + p.appliedCents, 0)
	};
}

/** Saldo devedor previsto numa data: parcelas vencidas e amortizações feitas até ela. */
export function outstandingAt(schedule: LoanSchedule, date: ISODate): number {
	if (date < schedule.startDate) return 0;
	let balance = schedule.principalCents;
	for (const i of schedule.installments) if (i.dueDate <= date) balance -= i.amortizationCents;
	for (const p of schedule.prepayments) if (p.date <= date) balance -= p.appliedCents;
	return Math.max(balance, 0);
}

/** Ids estáveis: dois aparelhos que lançarem a mesma parcela geram o mesmo registro. */
export const installmentKey = (loanId: ID, n: number) => `loan:${loanId}:${n}`;
export const prepaymentKey = (prepaymentId: ID) => `loan-prepayment:${prepaymentId}`;

/**
 * Parcelas pagas: as anteriores ao cadastro e as que têm lançamento vivo no extrato
 * (excluir o lançamento de uma parcela volta ela para "em aberto").
 */
export function paidInstallments(
	loan: Loan,
	schedule: LoanSchedule,
	liveTxIds: Set<ID>
): Set<number> {
	const paid = new Set<number>();
	for (const i of schedule.installments) {
		if (i.n <= loan.paidBefore || liveTxIds.has(stableUuid(installmentKey(loan.id, i.n))))
			paid.add(i.n);
	}
	return paid;
}

export const LOAN_KIND_LABEL = {
	home: 'Imóvel',
	vehicle: 'Veículo',
	personal: 'Empréstimo',
	other: 'Outro'
} as const;

export const SYSTEM_LABEL = { price: 'Price', sac: 'SAC' } as const;

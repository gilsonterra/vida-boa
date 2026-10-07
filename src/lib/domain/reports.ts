import { monthKey, monthRange, monthsBetween, shiftMonth, type MonthKey } from './dates';
import type { Account, AccountKind, AccountType, ID, Transaction } from './types';

/**
 * Agregações puras usadas pelo Início, pelo Extrato e pelas contas.
 * Transferências nunca contam como receita ou despesa: só movem dinheiro entre contas.
 * Estornos (despesa com valor positivo) abatem a despesa da categoria.
 */

const live = <T extends { deletedAt: string | null }>(xs: T[]) => xs.filter((x) => !x.deletedAt);

export function accountBalances(accounts: Account[], txs: Transaction[]): Map<ID, number> {
	const balances = new Map<ID, number>();
	for (const a of live(accounts)) balances.set(a.id, a.initialBalanceCents);
	for (const t of live(txs)) {
		if (balances.has(t.accountId))
			balances.set(t.accountId, balances.get(t.accountId)! + t.amountCents);
	}
	return balances;
}

export function balanceAt(account: Account, txs: Transaction[], date: string): number {
	let total = account.initialBalanceCents;
	for (const t of txs) {
		if (!t.deletedAt && t.accountId === account.id && t.date <= date) total += t.amountCents;
	}
	return total;
}

export interface MonthSummary {
	incomeCents: number;
	/** Valor positivo. */
	expenseCents: number;
	netCents: number;
}

export function summarize(txs: Transaction[]): MonthSummary {
	let income = 0;
	let expense = 0;
	for (const t of txs) {
		if (t.deletedAt) continue;
		if (t.kind === 'income') income += t.amountCents;
		else if (t.kind === 'expense') expense -= t.amountCents;
	}
	return { incomeCents: income, expenseCents: expense, netCents: income - expense };
}

export function inMonth(txs: Transaction[], key: MonthKey): Transaction[] {
	const { start, end } = monthRange(key);
	return txs.filter((t) => t.date >= start && t.date <= end);
}

/** Patrimônio líquido no último dia de cada mês. */
export function netWorthSeries(
	accounts: Account[],
	txs: Transaction[],
	months: MonthKey[]
): Array<{ month: MonthKey; totalCents: number }> {
	const liveAccounts = live(accounts);
	const ids = new Set(liveAccounts.map((a) => a.id));
	const initial = liveAccounts.reduce((s, a) => s + a.initialBalanceCents, 0);
	const deltas = new Map<MonthKey, number>();
	let before = 0;
	const first = months[0];
	for (const t of txs) {
		if (t.deletedAt || !ids.has(t.accountId)) continue;
		const k = monthKey(t.date);
		if (k < first) before += t.amountCents;
		else deltas.set(k, (deltas.get(k) ?? 0) + t.amountCents);
	}
	let running = initial + before;
	return months.map((m) => {
		running += deltas.get(m) ?? 0;
		return { month: m, totalCents: running };
	});
}

/**
 * Janela de meses para gráficos: até `max` meses terminando em `end`, mas sem
 * começar antes do primeiro mês com lançamentos (mantendo ao menos `min` meses).
 */
export function chartMonths(txs: Transaction[], end: MonthKey, max = 12, min = 6): MonthKey[] {
	let first = end;
	for (const t of txs) {
		const k = monthKey(t.date);
		if (k < first) first = k;
	}
	const earliest = shiftMonth(end, -(max - 1));
	const latestStart = shiftMonth(end, -(min - 1));
	const start = first < earliest ? earliest : first > latestStart ? latestStart : first;
	return monthsBetween(start, end);
}

/** Agrupa contas por natureza para a tela inicial. */
export const KIND_GROUPS: Array<{ label: string; kinds: AccountKind[] }> = [
	{ label: 'Contas', kinds: ['checking', 'savings', 'cash', 'other'] },
	{ label: 'Cartões', kinds: ['credit_card'] },
	{ label: 'Investimentos', kinds: ['investment'] }
];

export function kindOf(account: Account, types: AccountType[]): AccountKind {
	return types.find((t) => t.id === account.typeId)?.kind ?? 'other';
}

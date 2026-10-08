import { addDays } from './dates';
import type { Installment, LoanSchedule } from './loans';
import { occurrenceId, upcomingDates } from './recurrence';
import type { ID, ISODate, Loan, RecurringRule, Transaction } from './types';

/**
 * Regras de contabilização do Vida Boa, num lugar só.
 *
 * - Só o que está **consolidado** conta: saldo das contas, patrimônio, totais do mês e
 *   parcelas pagas do financiamento. A data não decide nada.
 * - A data só dá o padrão ao criar um lançamento: consolidado, a não ser que seja futura.
 * - Transferência é sempre consolidada: só move dinheiro entre as suas contas.
 * - Parcela de financiamento está paga quando você a consolida (ou se veio paga no cadastro).
 * - O que está pendente, mais as próximas recorrências, forma a previsão do patrimônio.
 */

// ── Regras ──────────────────────────────────────────────────────────────────────────

/**
 * Lançamento consolidado. Transferência sempre é; linhas antigas, de antes do campo
 * existir, também contam como consolidadas.
 */
export function isConsolidated(t: Pick<Transaction, 'consolidated' | 'kind'>): boolean {
	return t.kind === 'transfer' || t.consolidated !== false;
}

/** Se dá para marcar/desmarcar: transferência não tem a marca. */
export function canConsolidate(t: Pick<Transaction, 'kind'>): boolean {
	return t.kind !== 'transfer';
}

/** Padrão ao criar um lançamento: consolidado, a não ser que a data seja futura. */
export function defaultConsolidated(date: ISODate, today: ISODate): boolean {
	return date <= today;
}

/** Parcela paga: veio paga no cadastro (`paidBefore`) ou foi consolidada. */
export function isInstallmentConsolidated(loan: Loan, n: number): boolean {
	return n <= loan.paidBefore || loan.installmentStatus?.[n] === true;
}

/** Novo `installmentStatus` com a parcela marcada; pendente é o padrão, então sai da lista. */
export function withInstallmentStatus(
	loan: Loan,
	n: number,
	consolidated: boolean
): Record<string, boolean> {
	const next: Record<string, boolean> = {};
	for (const [k, v] of Object.entries(loan.installmentStatus ?? {})) if (v) next[k] = true;
	if (consolidated) next[n] = true;
	else delete next[n];
	return next;
}

export function paidInstallments(loan: Loan, schedule: LoanSchedule): Set<number> {
	const paid = new Set<number>();
	for (const i of schedule.installments) if (isInstallmentConsolidated(loan, i.n)) paid.add(i.n);
	return paid;
}

// ── Lançamentos, parcelas e previsões numa lista só ────────────────────────────────

/**
 * - `transaction`: lançamento gravado;
 * - `installment`: parcela de financiamento (calculada pelo contrato, sem conta);
 * - `recurring`: próxima ocorrência de uma recorrência, que ainda não virou lançamento.
 */
export type EntrySource = 'transaction' | 'installment' | 'recurring';

export interface Entry {
	/** Chave estável para listas. */
	key: string;
	source: EntrySource;
	date: ISODate;
	/** Negativo = saída, positivo = entrada. */
	amountCents: number;
	description: string;
	accountId: ID | null;
	categoryId: ID | null;
	transfer: boolean;
	/** `null` numa recorrência prevista: ainda não foi lançada (consolidar a lança). */
	consolidated: boolean | null;
	/** Recorrência de origem (itens `recurring`). */
	recurringRule?: RecurringRule;
	transaction?: Transaction;
	loan?: Loan;
	installment?: Installment;
}

export interface LedgerInput {
	transactions: Transaction[];
	recurring: RecurringRule[];
	loans: Loan[];
	schedules: Map<ID, LoanSchedule>;
	/** Contas que entram (as visíveis); `null` aceita todas. Parcelas não têm conta. */
	accountIds: Set<ID> | null;
	/** Ids de ocorrências puladas (lançamentos excluídos), que não voltam à previsão. */
	skippedIds?: Set<ID>;
}

/** Proteção contra recorrências semanais sem fim num período longo. */
const MAX_PER_RULE = 400;

export function transactionEntry(t: Transaction): Entry {
	return {
		key: `t:${t.id}`,
		source: 'transaction',
		date: t.date,
		amountCents: t.amountCents,
		description: t.description,
		accountId: t.accountId,
		categoryId: t.categoryId,
		transfer: t.kind === 'transfer',
		consolidated: isConsolidated(t),
		transaction: t
	};
}

function installmentEntry(loan: Loan, schedule: LoanSchedule, i: Installment): Entry {
	return {
		key: `i:${loan.id}:${i.n}`,
		source: 'installment',
		date: i.dueDate,
		amountCents: -i.paymentCents,
		description: `${loan.name} · parcela ${i.n}/${schedule.installments.length}`,
		accountId: null,
		categoryId: null,
		transfer: false,
		consolidated: isInstallmentConsolidated(loan, i.n),
		loan,
		installment: i
	};
}

function recurringEntries(input: LedgerInput, from: ISODate, to: ISODate): Entry[] {
	const out: Entry[] = [];
	// Ocorrências já lançadas (pagas adiantado, editadas) aparecem como lançamento; as
	// puladas somem. As duas se reconhecem pelo id da ocorrência.
	const taken = new Set(input.skippedIds);
	for (const t of input.transactions) if (t.recurringId) taken.add(t.id);
	for (const r of input.recurring) {
		if (r.deletedAt || !r.active || !accepts(input, r.accountId)) continue;
		const endDate = r.endDate && r.endDate < to ? r.endDate : to;
		for (const date of upcomingDates({ ...r, endDate }, MAX_PER_RULE)) {
			if (date < from || taken.has(occurrenceId(r.id, date))) continue;
			out.push({
				key: `r:${r.id}:${date}`,
				source: 'recurring',
				date,
				amountCents: r.kind === 'expense' ? -r.amountCents : r.amountCents,
				description: r.description,
				accountId: r.accountId,
				categoryId: r.categoryId,
				transfer: false,
				consolidated: null,
				recurringRule: r
			});
		}
	}
	return out;
}

const accepts = (input: LedgerInput, id: ID) => !input.accountIds || input.accountIds.has(id);
const byDate = (a: Entry, b: Entry) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key);

/** Tudo com data em [`from`, `to`]: lançamentos, parcelas e recorrências previstas. */
export function entriesBetween(input: LedgerInput, from: ISODate, to: ISODate): Entry[] {
	const out: Entry[] = [];
	for (const t of input.transactions) {
		if (t.deletedAt || t.date < from || t.date > to || !accepts(input, t.accountId)) continue;
		out.push(transactionEntry(t));
	}
	for (const loan of input.loans) {
		const schedule = !loan.deletedAt && input.schedules.get(loan.id);
		if (!schedule) continue;
		for (const i of schedule.installments) {
			if (i.dueDate >= from && i.dueDate <= to && i.n > loan.paidBefore)
				out.push(installmentEntry(loan, schedule, i));
		}
	}
	out.push(...recurringEntries(input, from, to));
	return out.sort(byDate);
}

/**
 * O que ainda vai mexer no patrimônio até `upTo`: lançamentos e parcelas pendentes
 * (inclusive os atrasados) e as recorrências previstas.
 */
export function pendingUpTo(input: LedgerInput, upTo: ISODate): Entry[] {
	return entriesBetween(input, '0000-01-01', upTo).filter((e) => e.consolidated !== true);
}

export function sumEntries(entries: Entry[]): number {
	return entries.reduce((s, e) => s + e.amountCents, 0);
}

/** Entradas e saídas (positivas) de uma lista, sem contar transferências. */
export function flows(entries: Entry[]): { incomeCents: number; expenseCents: number } {
	let income = 0;
	let expense = 0;
	for (const e of entries) {
		if (e.transfer) continue;
		// Como no resumo do mês: estorno (despesa positiva) abate a despesa.
		const kind = e.transaction?.kind ?? (e.amountCents > 0 ? 'income' : 'expense');
		if (kind === 'income') income += e.amountCents;
		else expense -= e.amountCents;
	}
	return { incomeCents: income, expenseCents: expense };
}

/** Saldo devedor assumindo pagas as parcelas pendentes que vencem até `date` (previsão). */
export function projectedPaid(loan: Loan, schedule: LoanSchedule, date: ISODate): Set<number> {
	const paid = paidInstallments(loan, schedule);
	for (const i of schedule.installments) if (i.dueDate <= date) paid.add(i.n);
	return paid;
}

/** Janela padrão da lista "a seguir" na tela inicial. */
export const SOON_DAYS = 14;
export const soon = (today: ISODate) => addDays(today, SOON_DAYS);

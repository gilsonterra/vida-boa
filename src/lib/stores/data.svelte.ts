import { getContext, setContext } from 'svelte';
import { store } from '../data';
import { live } from '../data/live.svelte';
import { today } from '../domain/dates';
import {
	entriesBetween,
	paidInstallments,
	pendingUpTo,
	projectedPaid,
	sumEntries,
	type Entry,
	type LedgerInput
} from '../domain/ledger';
import { buildSchedule, outstandingAt, type LoanSchedule } from '../domain/loans';
import { accountBalances } from '../domain/reports';
import type {
	Account,
	AccountKind,
	AccountType,
	CategorizationRule,
	Category,
	ID,
	ImportBatch,
	ISODate,
	Loan,
	LoanPrepayment,
	RecurringRule,
	Transaction
} from '../domain/types';

/**
 * Dados do app carregados uma vez e mantidos em memória, recalculados a cada escrita.
 * Finanças pessoais somam poucos milhares de lançamentos por ano, então manter tudo
 * em memória deixa a navegação instantânea, sem consulta ao abrir cada tela.
 */
export class AppData {
	#accounts = live(() => store.accounts.list(), [] as Account[]);
	#types = live(() => store.accountTypes.list(), [] as AccountType[]);
	#categories = live(() => store.categories.list(), [] as Category[]);
	#transactions = live(() => store.transactions.list(), [] as Transaction[]);
	#recurring = live(() => store.recurring.list(), [] as RecurringRule[]);
	#rules = live(() => store.rules.list(), [] as CategorizationRule[]);
	#imports = live(() => store.imports.list(), [] as ImportBatch[]);
	#loans = live(() => store.loans.list(), [] as Loan[]);
	#prepayments = live(() => store.loanPrepayments.list(), [] as LoanPrepayment[]);
	/** Ocorrências de recorrência puladas (excluídas), para não voltarem à previsão. */
	#skipped = live(
		async () =>
			new Set(
				(await store.transactions.list({ includeDeleted: true }))
					.filter((t) => t.deletedAt && t.recurringId)
					.map((t) => t.id)
			),
		new Set<ID>()
	);

	get accounts() {
		return this.#accounts.current;
	}
	/** Tipos em ordem estável: pela natureza (corrente primeiro) e depois pelo nome. */
	types = $derived(
		[...this.#types.current].sort(
			(a, b) =>
				KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
				a.name.localeCompare(b.name, 'pt-BR')
		)
	);
	get categories() {
		return this.#categories.current;
	}
	get transactions() {
		return this.#transactions.current;
	}
	get recurring() {
		return this.#recurring.current;
	}
	get rules() {
		return this.#rules.current;
	}
	get imports() {
		return this.#imports.current;
	}
	get loans() {
		return this.#loans.current;
	}
	get prepayments() {
		return this.#prepayments.current;
	}

	/** Tabela de cada financiamento, recalculada quando o contrato ou as amortizações mudam. */
	schedules = $derived(
		new Map<ID, LoanSchedule>(this.loans.map((l) => [l.id, buildSchedule(l, this.prepayments)]))
	);

	/** Parcelas pagas (consolidadas) de cada financiamento. */
	paid = $derived(
		new Map<ID, Set<number>>(
			this.loans.map((l) => [l.id, paidInstallments(l, this.schedules.get(l.id)!)])
		)
	);

	/** Saldo devedor de hoje: só as parcelas consolidadas abatem a dívida. */
	debt = $derived(
		this.loans.reduce(
			(s, l) => s + outstandingAt(this.schedules.get(l.id)!, today(), this.paid.get(l.id)),
			0
		)
	);

	/** Saldo devedor previsto numa data, contando como pagas as parcelas que vencem até ela. */
	projectedDebtAt(date: ISODate): number {
		let total = 0;
		for (const l of this.loans) {
			const s = this.schedules.get(l.id)!;
			total += outstandingAt(s, date, projectedPaid(l, s, date));
		}
		return total;
	}

	ready = $derived(
		!this.#accounts.loading &&
			!this.#types.loading &&
			!this.#categories.loading &&
			!this.#transactions.loading
	);

	accountById = $derived(new Map(this.accounts.map((a) => [a.id, a])));
	categoryById = $derived(new Map(this.categories.map((c) => [c.id, c])));
	typeById = $derived(new Map(this.types.map((t) => [t.id, t])));
	/** Saldo atual de cada conta: só lançamentos consolidados. */
	balances = $derived(accountBalances(this.accounts, this.transactions));

	/** Contas visíveis (não arquivadas), em ordem alfabética. */
	activeAccounts = $derived(
		this.accounts.filter((a) => !a.archived).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
	);

	expenseCategories = $derived(
		this.categories
			.filter((c) => c.kind === 'expense')
			.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
	);
	incomeCategories = $derived(
		this.categories
			.filter((c) => c.kind === 'income')
			.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
	);

	/** Patrimônio atual: soma dos saldos das contas visíveis. */
	netWorth = $derived(this.activeAccounts.reduce((s, a) => s + (this.balances.get(a.id) ?? 0), 0));

	/** Entrada das regras de `ledger.ts`: só contas visíveis. */
	#ledger = $derived<LedgerInput>({
		transactions: this.transactions,
		recurring: this.recurring,
		loans: this.loans,
		schedules: this.schedules,
		accountIds: new Set(this.activeAccounts.map((a) => a.id)),
		skippedIds: this.#skipped.current
	});

	/**
	 * Lançamentos, parcelas e recorrências previstas no período. Por padrão só das contas
	 * visíveis; `allAccounts` inclui as arquivadas (o extrato filtra por qualquer conta).
	 */
	entries(from: ISODate, to: ISODate, allAccounts = false): Entry[] {
		return entriesBetween(
			allAccounts ? { ...this.#ledger, accountIds: null } : this.#ledger,
			from,
			to
		);
	}

	/** Pendentes (inclusive atrasados) e recorrências previstas até `upTo`. */
	pending(upTo: ISODate): Entry[] {
		return pendingUpTo(this.#ledger, upTo);
	}

	/** Patrimônio previsto numa data: o atual mais tudo que está pendente até ela. */
	projectedNetWorth(date: ISODate): number {
		return this.netWorth + sumEntries(this.pending(date));
	}

	kindOf(accountId: ID): AccountKind {
		const account = this.accountById.get(accountId);
		return (account && this.typeById.get(account.typeId)?.kind) || 'other';
	}

	/** Contraparte de uma transferência (a outra perna), se existir. */
	partnerOf(t: Transaction): Transaction | undefined {
		if (!t.transferId) return undefined;
		return this.transactions.find((o) => o.transferId === t.transferId && o.id !== t.id);
	}
}

const KIND_ORDER: AccountKind[] = [
	'checking',
	'savings',
	'credit_card',
	'investment',
	'cash',
	'other'
];
const KEY = Symbol('app-data');

export function provideAppData(): AppData {
	return setContext(KEY, new AppData());
}

export function useAppData(): AppData {
	return getContext<AppData>(KEY);
}

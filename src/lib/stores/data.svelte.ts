import { getContext, setContext } from 'svelte';
import { store } from '../data';
import { live } from '../data/live.svelte';
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

	/** Soma dos saldos devedores previstos na data (entra negativa no patrimônio). */
	debtAt(date: ISODate): number {
		let total = 0;
		for (const s of this.schedules.values()) total += outstandingAt(s, date);
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

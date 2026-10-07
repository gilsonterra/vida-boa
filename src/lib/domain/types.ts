/**
 * Modelo de domínio do Vida Boa.
 *
 * Convenções pensadas para a futura sincronização com o Supabase:
 * - `id` é UUID gerado no cliente (vale igual no banco remoto);
 * - valores monetários são sempre centavos inteiros (`*Cents`);
 * - datas de lançamento são strings `YYYY-MM-DD` (sem fuso), timestamps são ISO;
 * - nada é apagado de verdade: `deletedAt` marca a exclusão lógica.
 */

export type ID = string;
/** Data civil no formato `YYYY-MM-DD`. */
export type ISODate = string;
/** Instante no formato ISO 8601. */
export type Timestamp = string;

export interface Entity {
	id: ID;
	createdAt: Timestamp;
	updatedAt: Timestamp;
	deletedAt: Timestamp | null;
}

export type AccountKind = 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash' | 'other';

export interface AccountType extends Entity {
	name: string;
	kind: AccountKind;
	/** Tipos pré-cadastrados não podem ser excluídos. */
	isSystem: boolean;
}

export interface Account extends Entity {
	name: string;
	typeId: ID;
	institution: string;
	/** Cor de destaque da conta (hex). */
	color: string;
	initialBalanceCents: number;
	currency: 'BRL';
	archived: boolean;
	/** Identificação da conta no OFX (BANKID/ACCTID), para casar importações automaticamente. */
	ofxBankId: string | null;
	ofxAccountId: string | null;
}

export type CategoryKind = 'expense' | 'income';

export interface Category extends Entity {
	name: string;
	kind: CategoryKind;
	/** Nome de um ícone do catálogo `CATEGORY_ICONS`. */
	icon: string;
	color: string;
	isSystem: boolean;
}

export type TransactionKind = 'expense' | 'income' | 'transfer';

export interface Transaction extends Entity {
	accountId: ID;
	date: ISODate;
	/** Negativo = saída da conta, positivo = entrada. */
	amountCents: number;
	description: string;
	notes: string;
	kind: TransactionKind;
	categoryId: ID | null;
	/** As duas pernas de uma transferência compartilham o mesmo `transferId`. */
	transferId: ID | null;
	/** Identificador da transação no banco (FITID do OFX). */
	fitId: string | null;
	importBatchId: ID | null;
	recurringId: ID | null;
}

export type Frequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule extends Entity {
	description: string;
	accountId: ID;
	categoryId: ID | null;
	kind: Exclude<TransactionKind, 'transfer'>;
	/** Sempre positivo; o sinal vem de `kind`. */
	amountCents: number;
	frequency: Frequency;
	startDate: ISODate;
	endDate: ISODate | null;
	/** Próxima data ainda não lançada. */
	nextDate: ISODate;
	active: boolean;
}

export type MatchType = 'contains' | 'starts_with' | 'equals';

export interface CategorizationRule extends Entity {
	pattern: string;
	matchType: MatchType;
	categoryId: ID;
	/** Restringe a regra a uma conta; `null` vale para todas. */
	accountId: ID | null;
	/** Maior prioridade vence quando mais de uma regra casa. */
	priority: number;
	isSystem: boolean;
}

export interface ImportBatch extends Entity {
	accountId: ID;
	fileName: string;
	importedCount: number;
	skippedCount: number;
	periodStart: ISODate | null;
	periodEnd: ISODate | null;
}

export type LoanKind = 'home' | 'vehicle' | 'personal' | 'other';
/** `contract`: o app calcula a tabela a partir do contrato; `simple`: parcela fixa × quantidade. */
export type LoanMode = 'contract' | 'simple';
/** Price: parcela fixa. SAC: amortização fixa (a parcela cai a cada mês). */
export type AmortizationSystem = 'price' | 'sac';

export interface Loan extends Entity {
	name: string;
	kind: LoanKind;
	mode: LoanMode;
	/** Só no modo `contract`; o modo simples funciona como Price sem juros. */
	system: AmortizationSystem;
	/** Valor financiado (modo `contract`). */
	principalCents: number;
	/** Taxa em porcentagem (ex.: 0.99), no período de `ratePeriod`. Zero no modo simples. */
	ratePercent: number;
	ratePeriod: 'month' | 'year';
	/** Valor da parcela (modo `simple`). */
	installmentCents: number;
	/** Quantidade de parcelas mensais do contrato. */
	termMonths: number;
	firstDueDate: ISODate;
	/** Parcelas pagas antes de cadastrar no app: contam como pagas, sem gerar lançamento. */
	paidBefore: number;
}

/** O que uma amortização extra reduz: o número de parcelas ou o valor de cada uma. */
/**
 * `term`/`installment`: amortização extra (valor pago a mais).
 * `balance`: saldo devedor informado pelo banco (ex.: correção pela TR); o valor é o saldo
 * novo, não um pagamento.
 */
export type PrepaymentEffect = 'term' | 'installment' | 'balance';

export interface LoanPrepayment extends Entity {
	loanId: ID;
	date: ISODate;
	amountCents: number;
	effect: PrepaymentEffect;
}

/** Campos que o chamador informa ao criar uma entidade. */
export type NewEntity<T extends Entity> = Omit<T, keyof Entity> & { id?: ID };

import { daysBetween } from '../domain/dates';
import { findMatchingRule } from '../domain/rules';
import { CARD_PAYMENT_PATTERN, INVESTMENT_MOVE_PATTERN } from '../domain/seed';
import { merchantKey, normalizeText, prettifyDescription } from '../domain/text';
import type {
	AccountKind,
	CategorizationRule,
	Category,
	ID,
	Transaction,
	TransactionKind
} from '../domain/types';
import type { OfxTransaction } from '../ofx/parse';

/**
 * Monta a prévia de uma importação, sem gravar nada. A gravação usa este plano depois
 * que o usuário revisa e confirma.
 *
 * Deduplicação, em ordem de confiança:
 * 1. FITID igual com o mesmo valor → duplicata certa (o banco diz que é o mesmo lançamento).
 *    FITID igual com valor diferente é tratado como colisão (alguns bancos reaproveitam FITID).
 * 2. Sem FITID de um dos lados: mesma data + valor + descrição → duplicata, contando ocorrências
 *    (dois cafés idênticos no mesmo dia são dois lançamentos se o arquivo tiver dois).
 * 3. Mesmo valor em até 3 dias contra um lançamento manual → possível duplicata,
 *    fica desmarcada para o usuário decidir.
 * Lançamentos excluídos pelo usuário também contam, para uma reimportação não ressuscitá-los.
 */

export type ImportStatus = 'new' | 'duplicate' | 'possible_duplicate';

export interface ImportItem {
	index: number;
	source: OfxTransaction;
	status: ImportStatus;
	reason: string | null;
	include: boolean;
	description: string;
	kind: TransactionKind;
	categoryId: ID | null;
	/** Lançamento já existente em outra conta que é a outra perna desta transferência. */
	pairWithId: ID | null;
}

export interface PlanContext {
	accountId: ID;
	accountKind: AccountKind;
	/** Lançamentos da conta de destino, inclusive excluídos. */
	existing: Transaction[];
	/** Lançamentos vivos das demais contas (para parear transferências). */
	others: Transaction[];
	accountKinds: Map<ID, AccountKind>;
	/** Histórico categorizado (para aprender por estabelecimento). */
	history: Transaction[];
	rules: CategorizationRule[];
	categories: Category[];
}

const POSSIBLE_DUP_WINDOW_DAYS = 3;
const TRANSFER_WINDOW_DAYS = 5;

function compositeKey(date: string, amount: number, description: string): string {
	return `${date}|${amount}|${normalizeText(description)}`;
}

export function buildImportPlan(incoming: OfxTransaction[], ctx: PlanContext): ImportItem[] {
	const byFitId = new Map<string, Transaction[]>();
	const composite = new Map<string, Transaction[]>();
	for (const t of ctx.existing) {
		if (t.fitId) byFitId.set(t.fitId, [...(byFitId.get(t.fitId) ?? []), t]);
		const k = compositeKey(t.date, t.amountCents, t.description);
		composite.set(k, [...(composite.get(k) ?? []), t]);
	}

	const consumed = new Set<ID>();
	const seenInFile = new Set<string>();
	const learned = learnFromHistory(ctx.history);
	const categoriesById = new Map(ctx.categories.filter((c) => !c.deletedAt).map((c) => [c.id, c]));
	const pairedOthers = new Set<ID>();

	return incoming.map((src, index) => {
		const base = { index, source: src, description: prettifyDescription(src.description) };

		// Repetido dentro do próprio arquivo.
		const fileKey = src.fitId ? `fit:${src.fitId}|${src.amountCents}|${src.date}` : null;
		if (fileKey && seenInFile.has(fileKey)) {
			return dup(base, 'Repetido no próprio arquivo');
		}
		if (fileKey) seenInFile.add(fileKey);

		// 1. FITID
		if (src.fitId) {
			const match = byFitId
				.get(src.fitId)
				?.find((t) => !consumed.has(t.id) && t.amountCents === src.amountCents);
			if (match) {
				consumed.add(match.id);
				return dup(base, match.deletedAt ? 'Já importado e excluído por você' : 'Já importado');
			}
		}

		// 2. Data + valor + descrição, quando algum lado não tem FITID.
		const compositeMatch = composite
			.get(compositeKey(src.date, src.amountCents, src.description))
			?.find((t) => !consumed.has(t.id) && (!t.fitId || !src.fitId));
		if (compositeMatch) {
			consumed.add(compositeMatch.id);
			return dup(base, compositeMatch.deletedAt ? 'Já lançado e excluído por você' : 'Já lançado');
		}

		// 3. Possível duplicata de lançamento manual.
		const near = ctx.existing.find(
			(t) =>
				!t.deletedAt &&
				!t.fitId &&
				!consumed.has(t.id) &&
				t.amountCents === src.amountCents &&
				Math.abs(daysBetween(t.date, src.date)) <= POSSIBLE_DUP_WINDOW_DAYS
		);

		const classification = classify(src, ctx, learned, categoriesById, pairedOthers);

		if (near) {
			consumed.add(near.id);
			return {
				...base,
				...classification,
				status: 'possible_duplicate' as const,
				reason: `Parecido com “${near.description}” de ${near.date.split('-').reverse().join('/')}`,
				include: false
			};
		}

		return { ...base, ...classification, status: 'new' as const, reason: null, include: true };
	});
}

function dup(
	base: Pick<ImportItem, 'index' | 'source' | 'description'>,
	reason: string
): ImportItem {
	return {
		...base,
		status: 'duplicate',
		reason,
		include: false,
		kind: base.source.amountCents < 0 ? 'expense' : 'income',
		categoryId: null,
		pairWithId: null
	};
}

function classify(
	src: OfxTransaction,
	ctx: PlanContext,
	learned: Map<string, ID>,
	categoriesById: Map<ID, Category>,
	pairedOthers: Set<ID>
): Pick<ImportItem, 'kind' | 'categoryId' | 'pairWithId'> {
	// Transferência: perna oposta já existente em outra conta.
	const pair = findTransferPair(src, ctx, pairedOthers);
	if (pair) {
		pairedOthers.add(pair.id);
		return { kind: 'transfer', categoryId: null, pairWithId: pair.id };
	}
	// Pagamento de fatura sem a outra perna ainda: no cartão é a entrada, na conta é a saída.
	// Vira transferência pendente; quando o outro extrato for importado, as duas se pareiam.
	const isCard = ctx.accountKind === 'credit_card';
	if (
		looksLikeCardPayment(src.description) &&
		(isCard ? src.amountCents > 0 : src.amountCents < 0)
	) {
		return { kind: 'transfer', categoryId: null, pairWithId: null };
	}
	// Aplicação e resgate (RDB, caixinha): o dinheiro continua seu, não é gasto nem ganho.
	if (INVESTMENT_MOVE_PATTERN.test(normalizeText(src.description))) {
		return { kind: 'transfer', categoryId: null, pairWithId: null };
	}

	const rule = findMatchingRule(ctx.rules, src.description, ctx.accountId);
	let categoryId = rule?.categoryId ?? learned.get(merchantKey(src.description)) ?? null;
	const category = categoryId ? categoriesById.get(categoryId) : undefined;
	if (!category) categoryId = null;

	if (src.amountCents < 0) {
		// Saída nunca é receita: descarta categoria de receita.
		return {
			kind: 'expense',
			categoryId: category?.kind === 'expense' ? categoryId : null,
			pairWithId: null
		};
	}
	// Entrada com categoria de despesa é estorno; no cartão, entrada sem categoria também.
	if (category?.kind === 'expense' || (!category && ctx.accountKind === 'credit_card')) {
		return { kind: 'expense', categoryId, pairWithId: null };
	}
	return { kind: 'income', categoryId, pairWithId: null };
}

function looksLikeCardPayment(description: string): boolean {
	return CARD_PAYMENT_PATTERN.test(normalizeText(description));
}

function findTransferPair(
	src: OfxTransaction,
	ctx: PlanContext,
	paired: Set<ID>
): Transaction | null {
	const candidates = ctx.others.filter(
		(t) =>
			!t.deletedAt &&
			!paired.has(t.id) &&
			t.amountCents === -src.amountCents &&
			Math.abs(daysBetween(t.date, src.date)) <= TRANSFER_WINDOW_DAYS
	);
	if (candidates.length === 0) return null;

	// Perna de transferência ainda sem par (ex.: pagamento de fatura importado do cartão).
	const unpaired = candidates.find((t) => t.kind === 'transfer' && !hasPartner(t, ctx.others));
	if (unpaired) return unpaired;

	// Pagamento de fatura: um dos lados é cartão e alguma descrição indica pagamento.
	const thisIsCard = ctx.accountKind === 'credit_card';
	return (
		candidates.find((t) => {
			const otherIsCard = ctx.accountKinds.get(t.accountId) === 'credit_card';
			return (
				(thisIsCard || otherIsCard) &&
				(looksLikeCardPayment(src.description) || looksLikeCardPayment(t.description))
			);
		}) ?? null
	);
}

function hasPartner(t: Transaction, all: Transaction[]): boolean {
	return (
		!!t.transferId &&
		all.some((o) => o.id !== t.id && o.transferId === t.transferId && !o.deletedAt)
	);
}

/** Para cada estabelecimento, a categoria usada mais recentemente. */
function learnFromHistory(history: Transaction[]): Map<string, ID> {
	const sorted = [...history]
		.filter((t) => !t.deletedAt && t.categoryId)
		.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
	const map = new Map<string, ID>();
	for (const t of sorted) {
		const key = merchantKey(t.description);
		if (key) map.set(key, t.categoryId!);
	}
	return map;
}

export function planSummary(items: ImportItem[]) {
	return {
		total: items.length,
		toImport: items.filter((i) => i.include).length,
		duplicates: items.filter((i) => i.status === 'duplicate').length,
		possible: items.filter((i) => i.status === 'possible_duplicate').length,
		uncategorized: items.filter((i) => i.include && i.kind !== 'transfer' && !i.categoryId).length
	};
}

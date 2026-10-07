import { describe, expect, it } from 'vitest';
import type { CategorizationRule, Category, Transaction } from '../domain/types';
import type { OfxTransaction } from '../ofx/parse';
import { buildImportPlan, planSummary, type PlanContext } from './plan';

const NOW = '2026-10-01T00:00:00.000Z';
const meta = { createdAt: NOW, updatedAt: NOW, deletedAt: null };

const categories: Category[] = [
	{
		id: 'c-transp',
		name: 'Transporte',
		kind: 'expense',
		icon: 'car',
		color: '#000',
		isSystem: true,
		...meta
	},
	{
		id: 'c-rest',
		name: 'Restaurantes',
		kind: 'expense',
		icon: 'utensils',
		color: '#000',
		isSystem: true,
		...meta
	},
	{
		id: 'c-sal',
		name: 'Salário',
		kind: 'income',
		icon: 'briefcase',
		color: '#000',
		isSystem: true,
		...meta
	}
];

const rules: CategorizationRule[] = [
	{
		id: 'r1',
		pattern: 'UBER',
		matchType: 'contains',
		categoryId: 'c-transp',
		accountId: null,
		priority: 0,
		isSystem: true,
		...meta
	},
	{
		id: 'r2',
		pattern: 'SALARIO',
		matchType: 'contains',
		categoryId: 'c-sal',
		accountId: null,
		priority: 0,
		isSystem: true,
		...meta
	}
];

function tx(
	p: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'amountCents' | 'description'>
): Transaction {
	return {
		accountId: 'acc',
		notes: '',
		kind: p.amountCents < 0 ? 'expense' : 'income',
		categoryId: null,
		transferId: null,
		fitId: null,
		importBatchId: null,
		recurringId: null,
		...meta,
		...p
	};
}

function ofx(
	p: Partial<OfxTransaction> & Pick<OfxTransaction, 'date' | 'amountCents' | 'description'>
): OfxTransaction {
	return { fitId: null, type: 'OTHER', checkNum: null, ...p };
}

function ctx(p: Partial<PlanContext> = {}): PlanContext {
	return {
		accountId: 'acc',
		accountKind: 'checking',
		existing: [],
		others: [],
		accountKinds: new Map([
			['acc', 'checking'],
			['card', 'credit_card']
		]),
		history: [],
		rules,
		categories,
		...p
	};
}

describe('deduplicação', () => {
	it('marca como duplicata o mesmo FITID com o mesmo valor', () => {
		const existing = [
			tx({ id: 'e1', date: '2026-10-02', amountCents: -1000, description: 'X', fitId: 'F1' })
		];
		const [item] = buildImportPlan(
			[ofx({ fitId: 'F1', date: '2026-10-02', amountCents: -1000, description: 'X' })],
			ctx({ existing })
		);
		expect(item).toMatchObject({ status: 'duplicate', include: false, reason: 'Já importado' });
	});

	it('trata FITID repetido com valor diferente como lançamento novo', () => {
		const existing = [
			tx({ id: 'e1', date: '2026-10-02', amountCents: -1000, description: 'X', fitId: 'F1' })
		];
		const [item] = buildImportPlan(
			[ofx({ fitId: 'F1', date: '2026-10-02', amountCents: -2500, description: 'Y' })],
			ctx({ existing })
		);
		expect(item.status).toBe('new');
	});

	it('não ressuscita lançamento excluído pelo usuário', () => {
		const existing = [
			tx({
				id: 'e1',
				date: '2026-10-02',
				amountCents: -1000,
				description: 'X',
				fitId: 'F1',
				deletedAt: NOW
			})
		];
		const [item] = buildImportPlan(
			[ofx({ fitId: 'F1', date: '2026-10-02', amountCents: -1000, description: 'X' })],
			ctx({ existing })
		);
		expect(item).toMatchObject({ status: 'duplicate', reason: 'Já importado e excluído por você' });
	});

	it('conta ocorrências iguais sem FITID (dois cafés no mesmo dia)', () => {
		const existing = [tx({ id: 'e1', date: '2026-10-02', amountCents: -800, description: 'CAFE' })];
		const items = buildImportPlan(
			[
				ofx({ date: '2026-10-02', amountCents: -800, description: 'Café' }),
				ofx({ date: '2026-10-02', amountCents: -800, description: 'CAFE' })
			],
			ctx({ existing })
		);
		expect(items.map((i) => i.status)).toEqual(['duplicate', 'new']);
	});

	it('ignora repetição dentro do próprio arquivo', () => {
		const t = ofx({ fitId: 'F9', date: '2026-10-02', amountCents: -500, description: 'Z' });
		expect(buildImportPlan([t, { ...t }], ctx()).map((i) => i.status)).toEqual([
			'new',
			'duplicate'
		]);
	});

	it('sinaliza possível duplicata de lançamento manual próximo', () => {
		const existing = [
			tx({ id: 'm1', date: '2026-10-01', amountCents: -12000, description: 'Jantar' })
		];
		const [item] = buildImportPlan(
			[
				ofx({
					fitId: 'F2',
					date: '2026-10-03',
					amountCents: -12000,
					description: 'RESTAURANTE XYZ'
				})
			],
			ctx({ existing })
		);
		expect(item).toMatchObject({ status: 'possible_duplicate', include: false });
	});
});

describe('categorização', () => {
	it('aplica regra e respeita o sinal do valor', () => {
		const items = buildImportPlan(
			[
				ofx({ date: '2026-10-02', amountCents: -3500, description: 'UBER *TRIP' }),
				ofx({ date: '2026-10-05', amountCents: 1500000, description: 'SALARIO EMPRESA' }),
				ofx({ date: '2026-10-05', amountCents: -100, description: 'ESTORNO SALARIO' })
			],
			ctx()
		);
		expect(items.map((i) => [i.kind, i.categoryId])).toEqual([
			['expense', 'c-transp'],
			['income', 'c-sal'],
			['expense', null]
		]);
	});

	it('aprende a categoria pelo histórico do estabelecimento', () => {
		const history = [
			tx({
				id: 'h1',
				date: '2026-09-01',
				amountCents: -9000,
				description: 'FASANO 01/09 A7B2',
				categoryId: 'c-rest'
			})
		];
		const [item] = buildImportPlan(
			[ofx({ date: '2026-10-02', amountCents: -15000, description: 'FASANO 02/10 Q9Z1' })],
			ctx({ history })
		);
		expect(item.categoryId).toBe('c-rest');
	});

	it('trata entrada sem categoria no cartão como estorno', () => {
		const [item] = buildImportPlan(
			[ofx({ date: '2026-10-02', amountCents: 5000, description: 'CREDITO LOJA' })],
			ctx({ accountKind: 'credit_card' })
		);
		expect(item.kind).toBe('expense');
	});
});

describe('transferências', () => {
	it('pareia o pagamento da fatura com a perna já importada do cartão', () => {
		const others = [
			tx({
				id: 'p1',
				accountId: 'card',
				date: '2026-10-10',
				amountCents: 500000,
				description: 'Pagamento recebido',
				kind: 'transfer',
				transferId: 'T1'
			})
		];
		const [item] = buildImportPlan(
			[ofx({ date: '2026-10-09', amountCents: -500000, description: 'PAG FATURA CARTAO' })],
			ctx({ others })
		);
		expect(item).toMatchObject({ kind: 'transfer', pairWithId: 'p1', categoryId: null });
	});

	it('marca pagamento recebido no cartão como transferência pendente', () => {
		const [item] = buildImportPlan(
			[ofx({ date: '2026-10-10', amountCents: 500000, description: 'Pagamento recebido' })],
			ctx({ accountId: 'card', accountKind: 'credit_card' })
		);
		expect(item).toMatchObject({ kind: 'transfer', pairWithId: null });
	});

	it('marca pagamento de fatura na conta corrente como transferência pendente', () => {
		const [item] = buildImportPlan(
			[ofx({ date: '2026-10-09', amountCents: -500000, description: 'Pagamento de fatura' })],
			ctx()
		);
		expect(item).toMatchObject({ kind: 'transfer', pairWithId: null, categoryId: null });
	});

	it('trata aplicação e resgate de investimento como transferência', () => {
		const items = buildImportPlan(
			[
				ofx({ date: '2026-10-02', amountCents: -100000, description: 'Aplicação RDB' }),
				ofx({ date: '2026-10-03', amountCents: 50000, description: 'Resgate RDB' }),
				ofx({
					date: '2026-10-04',
					amountCents: 1200,
					description: 'Devolução - Aplicação em investimento'
				})
			],
			ctx()
		);
		expect(items.map((i) => i.kind)).toEqual(['transfer', 'transfer', 'transfer']);
	});

	it('não pareia valores iguais sem indício de transferência', () => {
		const others = [
			tx({
				id: 'o1',
				accountId: 'card',
				date: '2026-10-10',
				amountCents: 3000,
				description: 'Estorno'
			})
		];
		const [item] = buildImportPlan(
			[ofx({ date: '2026-10-10', amountCents: -3000, description: 'Livraria' })],
			ctx({ others })
		);
		expect(item.kind).toBe('expense');
	});
});

describe('planSummary', () => {
	it('resume a prévia', () => {
		const items = buildImportPlan(
			[
				ofx({ date: '2026-10-02', amountCents: -3500, description: 'UBER' }),
				ofx({ date: '2026-10-02', amountCents: -10, description: 'Desconhecido' })
			],
			ctx()
		);
		expect(planSummary(items)).toEqual({
			total: 2,
			toImport: 2,
			duplicates: 0,
			possible: 0,
			uncategorized: 1
		});
	});
});

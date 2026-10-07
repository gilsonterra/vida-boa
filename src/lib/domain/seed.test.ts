import { describe, expect, it } from 'vitest';
import { findMatchingRule } from './rules';
import { INVESTMENT_MOVE_PATTERN, SEED_CATEGORIES, SEED_RULES } from './seed';
import { normalizeText } from './text';
import type { CategorizationRule } from './types';

const meta = { createdAt: '', updatedAt: '', deletedAt: null };
const rules: CategorizationRule[] = SEED_RULES.map((r, i) => ({
	id: `r${i}`,
	pattern: r.pattern,
	matchType: r.matchType,
	categoryId: r.category,
	accountId: null,
	priority: 0,
	isSystem: true,
	...meta
}));

const categorize = (description: string) =>
	findMatchingRule(rules, description, 'acc')?.categoryId ?? null;

describe('regras iniciais', () => {
	it('apontam só para categorias que existem', () => {
		const names = new Set(SEED_CATEGORIES.map((c) => c.name));
		expect(SEED_RULES.filter((r) => !names.has(r.category))).toEqual([]);
	});

	// Descrições no formato real dos extratos (nomes de pessoas trocados).
	it.each([
		['Costa Atacadao', 'Mercado'],
		['Super Uniao Supermerca', 'Mercado'],
		['Campo Belo Combustivei', 'Combustível'],
		['Mp *Espetinhopere', 'Restaurantes'],
		['Panificadora Andrade', 'Restaurantes'],
		['Flamboyant Estacioname', 'Transporte'],
		['Concebra', 'Transporte'],
		['Amazon', 'Compras'],
		['Amazon Digital', 'Assinaturas'],
		['Lojas Renner Fl - Parcela 3/3', 'Vestuário'],
		['Pagamento de boleto efetuado - GCI CAIXA - HABITACAO', 'Financiamentos'],
		['Pagamento de boleto efetuado - DEPARTAMENTO ESTADUAL DE TRANSITO', 'Impostos & Taxas'],
		['Transferência enviada pelo Pix - EQUATORIAL GOIAS DISTRIBUIDORA DE ENERGIA S A', 'Moradia'],
		['Desconto Antecipação Lojas Renner', 'Reembolsos'],
		['Zig *Bar das Ondas', 'Restaurantes'],
		['Companhia do Grelhado', 'Restaurantes'],
		['L Moura Carnes', 'Mercado']
	])('%s → %s', (description, category) => {
		expect(categorize(description)).toBe(category);
	});

	it('não confunde o banco de destino do PIX com o estabelecimento', () => {
		expect(
			categorize(
				'Transferência enviada pelo Pix - FULANO DE TAL - •••.123.456-•• - PAGSEGURO INTERNET IP S A Agência: 1 Conta: 2'
			)
		).toBeNull();
	});

	it('reconhece movimentações de investimento', () => {
		for (const d of [
			'Aplicação RDB',
			'Resgate RDB',
			'Aplicação em investimento',
			'Dinheiro guardado'
		]) {
			expect(INVESTMENT_MOVE_PATTERN.test(normalizeText(d))).toBe(true);
		}
		expect(INVESTMENT_MOVE_PATTERN.test(normalizeText('Rendimento da conta'))).toBe(false);
	});
});

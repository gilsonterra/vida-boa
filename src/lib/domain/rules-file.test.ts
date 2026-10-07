import { describe, expect, it } from 'vitest';
import { buildRulesFile, parseRulesFile, planRulesImport } from './rules-file';
import type { CategorizationRule, Category } from './types';

const meta = { createdAt: '', updatedAt: '', deletedAt: null };
const cat = (id: string, name: string): Category => ({
	id,
	name,
	kind: 'expense',
	icon: 'circle',
	color: '#000',
	isSystem: true,
	...meta
});
const categories = [cat('c1', 'Restaurantes'), cat('c2', 'Mercado')];
const rule = (pattern: string, categoryId: string, isSystem = false): CategorizationRule => ({
	id: pattern,
	pattern,
	matchType: 'contains',
	categoryId,
	accountId: null,
	priority: 10,
	isSystem,
	...meta
});

describe('arquivo de regras', () => {
	it('rejeita arquivos que não são de regras', () => {
		expect(() => parseRulesFile({ app: 'vida-boa', tables: {} })).toThrow(
			/não é um arquivo de regras/
		);
		expect(() => parseRulesFile(null)).toThrow();
	});

	it('importa só o que falta e aponta categorias desconhecidas', () => {
		const file = parseRulesFile({
			app: 'vida-boa',
			type: 'rules',
			version: 1,
			rules: [
				{ pattern: 'Q DELICIA', matchType: 'contains', category: 'restaurantes' },
				{ pattern: 'q delícia', matchType: 'contains', category: 'Restaurantes' },
				{ pattern: 'FEIRA', matchType: 'contains', category: 'Mercado' },
				{ pattern: 'X', matchType: 'contains', category: 'Inexistente' },
				{ pattern: '', matchType: 'contains', category: 'Mercado' },
				{ pattern: 'Y', matchType: 'regex', category: 'Mercado' }
			]
		});
		const plan = planRulesImport(file, [rule('FEIRA', 'c2')], categories);
		expect(plan.create).toEqual([
			{ pattern: 'Q DELICIA', matchType: 'contains', categoryId: 'c1' }
		]);
		expect(plan.duplicates).toBe(2);
		expect(plan.unknownCategories).toEqual(['Inexistente']);
	});

	it('exporta só as regras do usuário, com o nome da categoria', () => {
		const file = buildRulesFile([rule('MINHA', 'c1'), rule('PRONTA', 'c2', true)], categories);
		expect(file.rules).toEqual([
			{ pattern: 'MINHA', matchType: 'contains', category: 'Restaurantes' }
		]);
	});
});

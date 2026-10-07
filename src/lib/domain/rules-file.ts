import { normalizeText } from './text';
import type { CategorizationRule, Category, ID, MatchType } from './types';

/**
 * Arquivo de regras pessoais (JSON). As categorias vão pelo nome, não pelo id, para o arquivo
 * funcionar em outro aparelho ou depois de restaurar um backup.
 */
export interface RulesFile {
	app: 'vida-boa';
	type: 'rules';
	version: 1;
	rules: Array<{ pattern: string; matchType: MatchType; category: string }>;
}

const MATCH_TYPES: MatchType[] = ['contains', 'starts_with', 'equals'];

export function parseRulesFile(data: unknown): RulesFile {
	const f = data as Partial<RulesFile> | null;
	if (!f || f.app !== 'vida-boa' || f.type !== 'rules' || !Array.isArray(f.rules)) {
		throw new Error('Este arquivo não é um arquivo de regras do Vida Boa.');
	}
	const rules = f.rules.filter(
		(r) =>
			r &&
			typeof r.pattern === 'string' &&
			r.pattern.trim() !== '' &&
			typeof r.category === 'string' &&
			MATCH_TYPES.includes(r.matchType)
	);
	return { app: 'vida-boa', type: 'rules', version: 1, rules };
}

export interface RulesImportPlan {
	create: Array<{ pattern: string; matchType: MatchType; categoryId: ID }>;
	/** Já existiam (mesmo texto e categoria). */
	duplicates: number;
	/** Nomes de categoria do arquivo que não existem neste aparelho. */
	unknownCategories: string[];
}

export function planRulesImport(
	file: RulesFile,
	existing: CategorizationRule[],
	categories: Category[]
): RulesImportPlan {
	const byName = new Map(
		categories.filter((c) => !c.deletedAt).map((c) => [normalizeText(c.name), c.id])
	);
	const taken = new Set(
		existing.filter((r) => !r.deletedAt).map((r) => `${normalizeText(r.pattern)}|${r.categoryId}`)
	);
	const unknown = new Set<string>();
	const plan: RulesImportPlan = { create: [], duplicates: 0, unknownCategories: [] };

	for (const r of file.rules) {
		const categoryId = byName.get(normalizeText(r.category));
		if (!categoryId) {
			unknown.add(r.category);
			continue;
		}
		const key = `${normalizeText(r.pattern)}|${categoryId}`;
		if (taken.has(key)) {
			plan.duplicates++;
			continue;
		}
		taken.add(key);
		plan.create.push({ pattern: r.pattern.trim(), matchType: r.matchType, categoryId });
	}
	plan.unknownCategories = [...unknown];
	return plan;
}

/** Exporta só as regras criadas pelo usuário (as prontas já vêm com o app). */
export function buildRulesFile(rules: CategorizationRule[], categories: Category[]): RulesFile {
	const names = new Map(categories.map((c) => [c.id, c.name]));
	return {
		app: 'vida-boa',
		type: 'rules',
		version: 1,
		rules: rules
			.filter((r) => !r.deletedAt && !r.isSystem && names.has(r.categoryId))
			.map((r) => ({
				pattern: r.pattern,
				matchType: r.matchType,
				category: names.get(r.categoryId)!
			}))
	};
}

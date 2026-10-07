import { normalizeText } from './text';
import type { CategorizationRule, ID } from './types';

export function ruleMatches(rule: CategorizationRule, description: string, accountId: ID): boolean {
	if (rule.deletedAt) return false;
	if (rule.accountId && rule.accountId !== accountId) return false;
	const pattern = normalizeText(rule.pattern);
	if (!pattern) return false;
	const text = normalizeText(description);
	switch (rule.matchType) {
		case 'equals':
			return text === pattern;
		case 'starts_with':
			return text.startsWith(pattern);
		case 'contains': {
			// Casa por palavra inteira para "99" não casar com "R$ 1990". O "*" dos prefixos de
			// maquininha ("ZIG *BAR", "MP *LOJA") conta como separador de palavras.
			const words = ` ${text.replace(/\*/g, ' ')} `;
			const bare = pattern.replace(/\*/g, ' ').trim();
			return words.includes(` ${bare} `) || (pattern.length >= 4 && text.includes(pattern));
		}
	}
}

/**
 * Escolhe a regra vencedora: maior prioridade, depois regras do usuário antes das do sistema,
 * depois o padrão mais longo (mais específico).
 */
export function findMatchingRule(
	rules: CategorizationRule[],
	description: string,
	accountId: ID
): CategorizationRule | null {
	let best: CategorizationRule | null = null;
	for (const rule of rules) {
		if (!ruleMatches(rule, description, accountId)) continue;
		if (!best || compareRules(rule, best) > 0) best = rule;
	}
	return best;
}

function compareRules(a: CategorizationRule, b: CategorizationRule): number {
	if (a.priority !== b.priority) return a.priority - b.priority;
	if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
	if (!!a.accountId !== !!b.accountId) return a.accountId ? 1 : -1;
	return a.pattern.length - b.pattern.length;
}

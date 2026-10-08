import { addDays, nextOccurrence } from './dates';
import { stableUuid } from './ids';
import type { ID, ISODate, RecurringRule } from './types';

/**
 * Id da ocorrência de uma recorrência num dia. Lançar, pular (lançar e excluir) e a criação
 * automática usam o mesmo id, então nada se duplica, nem entre aparelhos.
 */
export function occurrenceId(ruleId: ID, date: ISODate): ID {
	return stableUuid(`recurring:${ruleId}:${date}`);
}

/** Último dia antes de `date`: encerrar "a partir desta" mantém as anteriores. */
export function endBefore(date: ISODate): ISODate {
	return addDays(date, -1);
}

/** Proteção contra loops caso uma regra antiga fique anos sem ser processada. */
const MAX_OCCURRENCES = 400;

/**
 * Calcula as ocorrências de uma regra recorrente que venceram até `upTo` (inclusive)
 * e a próxima data pendente depois delas.
 */
export function dueOccurrences(
	rule: Pick<RecurringRule, 'nextDate' | 'endDate' | 'frequency' | 'startDate' | 'active'>,
	upTo: ISODate
): { dates: ISODate[]; nextDate: ISODate } {
	const dates: ISODate[] = [];
	let cursor = rule.nextDate;
	if (!rule.active) return { dates, nextDate: cursor };
	while (cursor <= upTo && (!rule.endDate || cursor <= rule.endDate)) {
		dates.push(cursor);
		cursor = nextOccurrence(cursor, rule.frequency, rule.startDate);
		if (dates.length >= MAX_OCCURRENCES) break;
	}
	return { dates, nextDate: cursor };
}

/** Próximas `count` datas a partir de `nextDate`, para a lista "a vencer". */
export function upcomingDates(
	rule: Pick<RecurringRule, 'nextDate' | 'endDate' | 'frequency' | 'startDate'>,
	count: number
): ISODate[] {
	const out: ISODate[] = [];
	let cursor = rule.nextDate;
	while (out.length < count && (!rule.endDate || cursor <= rule.endDate)) {
		out.push(cursor);
		cursor = nextOccurrence(cursor, rule.frequency, rule.startDate);
	}
	return out;
}

export const FREQUENCY_LABEL = {
	weekly: 'Semanal',
	monthly: 'Mensal',
	yearly: 'Anual'
} as const;

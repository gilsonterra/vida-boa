import type { Frequency, ISODate } from './types';

/**
 * Datas de lançamento são datas civis (`YYYY-MM-DD`), sem fuso horário.
 * As contas são feitas em UTC para que horário de verão e fuso nunca mudem o dia.
 */

function toUTC(date: ISODate): Date {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(d: Date): ISODate {
	return d.toISOString().slice(0, 10);
}

/** Data de hoje no fuso do aparelho. */
export function today(now: Date = new Date()): ISODate {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function addDays(date: ISODate, days: number): ISODate {
	const d = toUTC(date);
	d.setUTCDate(d.getUTCDate() + days);
	return fromUTC(d);
}

/** Soma meses preservando o dia quando possível (31/jan + 1 mês = 28 ou 29/fev). */
export function addMonths(date: ISODate, months: number, anchorDay?: number): ISODate {
	const d = toUTC(date);
	const day = anchorDay ?? d.getUTCDate();
	const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
	const lastDay = new Date(
		Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
	).getUTCDate();
	target.setUTCDate(Math.min(day, lastDay));
	return fromUTC(target);
}

export function daysBetween(a: ISODate, b: ISODate): number {
	return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

/** Avança uma ocorrência de acordo com a frequência, ancorado no dia da data inicial. */
export function nextOccurrence(date: ISODate, frequency: Frequency, anchor: ISODate): ISODate {
	const anchorDay = Number(anchor.slice(8, 10));
	switch (frequency) {
		case 'weekly':
			return addDays(date, 7);
		case 'monthly':
			return addMonths(date, 1, anchorDay);
		case 'yearly':
			return addMonths(date, 12, anchorDay);
	}
}

/** `2026-10` */
export type MonthKey = string;

export function monthKey(date: ISODate): MonthKey {
	return date.slice(0, 7);
}

export function monthRange(key: MonthKey): { start: ISODate; end: ISODate } {
	const start = `${key}-01`;
	const end = addDays(addMonths(start, 1), -1);
	return { start, end };
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
	return monthKey(addMonths(`${key}-01`, delta));
}

/** Lista as chaves de mês de `from` até `to`, inclusive. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
	const out: MonthKey[] = [];
	for (let k = from; k <= to; k = shiftMonth(k, 1)) out.push(k);
	return out;
}

const monthLong = new Intl.DateTimeFormat('pt-BR', {
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});
const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const dayLong = new Intl.DateTimeFormat('pt-BR', {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	timeZone: 'UTC'
});
const dayShort = new Intl.DateTimeFormat('pt-BR', {
	day: '2-digit',
	month: 'short',
	timeZone: 'UTC'
});

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `2026-10` → `Outubro de 2026` */
export function formatMonth(key: MonthKey): string {
	return capitalize(monthLong.format(toUTC(`${key}-01`)));
}

/** `2026-10` → `out` */
export function formatMonthShort(key: MonthKey): string {
	return monthShort.format(toUTC(`${key}-01`)).replace('.', '');
}

/** Rótulo de agrupamento do extrato: Hoje, Ontem ou `Sexta-feira, 3 de outubro`. */
export function formatDayHeading(date: ISODate, ref: ISODate = today()): string {
	const diff = daysBetween(date, ref);
	if (diff === 0) return 'Hoje';
	if (diff === 1) return 'Ontem';
	return capitalize(dayLong.format(toUTC(date)));
}

/** `2026-10-03` → `03 out` */
export function formatDayShort(date: ISODate): string {
	return dayShort.format(toUTC(date)).replace('.', '').replace(' de ', ' ');
}

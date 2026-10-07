import { parseAmountToCents } from '../domain/money';
import type { ISODate } from '../domain/types';

/**
 * Parser de OFX 1.x (SGML) e 2.x (XML).
 *
 * No OFX 1.x, campos-folha não têm tag de fechamento (`<TRNAMT>-10.00`) e só os agregados
 * fecham (`</STMTTRN>`). Em vez de manter uma lista de quais tags são folhas, o parser
 * descobre isso no próprio arquivo: uma tag é agregado se o arquivo contém o fechamento dela.
 * Assim, o mesmo código lê SGML, XML e variações de bancos.
 */

export interface OfxTransaction {
	fitId: string | null;
	date: ISODate;
	amountCents: number;
	/** TRNTYPE: DEBIT, CREDIT, PAYMENT, XFER... */
	type: string;
	description: string;
	checkNum: string | null;
}

export interface OfxStatement {
	kind: 'bank' | 'credit_card';
	currency: string;
	bankId: string | null;
	accountId: string | null;
	accountType: string | null;
	start: ISODate | null;
	end: ISODate | null;
	ledgerBalanceCents: number | null;
	ledgerDate: ISODate | null;
	transactions: OfxTransaction[];
}

export interface OfxDocument {
	statements: OfxStatement[];
	/** Linhas ignoradas por estarem malformadas (ex.: valor ilegível). */
	warnings: string[];
}

export class OfxParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OfxParseError';
	}
}

interface Node {
	name: string;
	value: string | null;
	children: Node[];
}

/**
 * Decodifica os bytes do arquivo. O cabeçalho não é confiável: o Nubank, por exemplo, declara
 * `CHARSET:1252` e manda UTF-8, enquanto outros bancos declaram `USASCII` e mandam latin-1.
 * Por isso tenta UTF-8 estrito primeiro (texto latin-1 com acentos quase nunca é UTF-8 válido)
 * e só então cai para windows-1252.
 */
export function decodeOfx(bytes: Uint8Array): string {
	try {
		return stripBom(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
	} catch {
		return stripBom(new TextDecoder('windows-1252').decode(bytes));
	}
}

function stripBom(s: string): string {
	return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

function decodeEntities(s: string): string {
	return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
		if (e[0] === '#') {
			const code =
				e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			// Fora do intervalo Unicode, String.fromCodePoint lançaria erro: mantém o texto original.
			return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
				? String.fromCodePoint(code)
				: m;
		}
		return ENTITIES[e.toLowerCase()] ?? m;
	});
}

function buildTree(text: string): Node {
	const start = text.search(/<OFX>/i);
	if (start === -1)
		throw new OfxParseError('O arquivo não parece ser um OFX: a tag <OFX> não foi encontrada.');
	const body = text.slice(start);

	const closing = new Set<string>();
	for (const m of body.matchAll(/<\/([A-Za-z0-9.]+)\s*>/g)) closing.add(m[1].toUpperCase());

	const root: Node = { name: '#root', value: null, children: [] };
	const stack: Node[] = [root];
	const tag = /<(\/?)([A-Za-z0-9.]+)[^>]*>([^<]*)/g;

	for (const m of body.matchAll(tag)) {
		const isClose = m[1] === '/';
		const name = m[2].toUpperCase();
		const text = m[3].trim();
		const top = stack[stack.length - 1];

		if (isClose) {
			// Fecha até encontrar o agregado correspondente; fechamentos de folhas (XML) são ignorados.
			const idx = stack.findLastIndex((n) => n.name === name);
			if (idx > 0) stack.length = idx;
			continue;
		}

		if (text !== '' || !closing.has(name)) {
			top.children.push({ name, value: decodeEntities(text), children: [] });
		} else {
			const node: Node = { name, value: null, children: [] };
			top.children.push(node);
			stack.push(node);
		}
	}
	return root;
}

function child(node: Node | undefined, name: string): Node | undefined {
	return node?.children.find((c) => c.name === name);
}

function leaf(node: Node | undefined, name: string): string | null {
	const v = child(node, name)?.value;
	return v ? v : null;
}

function findAll(node: Node, names: string[], out: Node[] = []): Node[] {
	for (const c of node.children) {
		if (names.includes(c.name)) out.push(c);
		else findAll(c, names, out);
	}
	return out;
}

/** `20261003120000[-3:BRT]` → `2026-10-03` */
export function parseOfxDate(raw: string | null): ISODate | null {
	if (!raw) return null;
	const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
	if (!m) return null;
	const [, y, mo, d] = m;
	if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
	return `${y}-${mo}-${d}`;
}

/** Escolhe a melhor descrição entre NAME e MEMO (bancos usam um, outro ou ambos). */
export function pickDescription(name: string | null, memo: string | null): string {
	const n = (name ?? '').replace(/\s+/g, ' ').trim();
	const mm = (memo ?? '').replace(/\s+/g, ' ').trim();
	if (!n) return mm;
	if (!mm || mm === n) return n;
	const un = n.toUpperCase();
	const um = mm.toUpperCase();
	if (um.startsWith(un)) return mm; // NAME truncado (comum: 32 caracteres)
	if (un.includes(um)) return n;
	return `${n} · ${mm}`;
}

export function parseOfx(text: string): OfxDocument {
	const root = buildTree(text);
	const warnings: string[] = [];
	const statements: OfxStatement[] = [];

	for (const stmt of findAll(root, ['STMTRS', 'CCSTMTRS'])) {
		const isCard = stmt.name === 'CCSTMTRS';
		const acct = child(stmt, isCard ? 'CCACCTFROM' : 'BANKACCTFROM');
		const list = child(stmt, 'BANKTRANLIST');
		const ledger = child(stmt, 'LEDGERBAL');

		const transactions: OfxTransaction[] = [];
		for (const trn of list?.children.filter((c) => c.name === 'STMTTRN') ?? []) {
			const date = parseOfxDate(leaf(trn, 'DTPOSTED') ?? leaf(trn, 'DTUSER'));
			const rawAmount = leaf(trn, 'TRNAMT');
			const amountCents = rawAmount ? parseAmountToCents(rawAmount, { dotIsDecimal: true }) : null;
			const description = pickDescription(
				leaf(trn, 'NAME') ?? leaf(trn, 'PAYEE'),
				leaf(trn, 'MEMO')
			);
			if (!date || amountCents === null) {
				warnings.push(
					`Lançamento ignorado (data ou valor inválido): ${description || leaf(trn, 'FITID') || '?'}`
				);
				continue;
			}
			transactions.push({
				fitId: leaf(trn, 'FITID'),
				date,
				amountCents,
				type: (leaf(trn, 'TRNTYPE') ?? 'OTHER').toUpperCase(),
				description: description || 'Sem descrição',
				checkNum: leaf(trn, 'CHECKNUM')
			});
		}

		const balRaw = leaf(ledger, 'BALAMT');
		statements.push({
			kind: isCard ? 'credit_card' : 'bank',
			currency: (leaf(stmt, 'CURDEF') ?? 'BRL').toUpperCase(),
			bankId: leaf(acct, 'BANKID'),
			accountId: leaf(acct, 'ACCTID'),
			accountType: leaf(acct, 'ACCTTYPE'),
			start: parseOfxDate(leaf(list, 'DTSTART')),
			end: parseOfxDate(leaf(list, 'DTEND')),
			ledgerBalanceCents: balRaw ? parseAmountToCents(balRaw, { dotIsDecimal: true }) : null,
			ledgerDate: parseOfxDate(leaf(ledger, 'DTASOF')),
			transactions
		});
	}

	if (statements.length === 0) {
		throw new OfxParseError(
			'Nenhum extrato encontrado no arquivo. Verifique se é um OFX de conta ou cartão.'
		);
	}
	return { statements, warnings };
}

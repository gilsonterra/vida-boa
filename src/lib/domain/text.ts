/**
 * Normaliza descrições bancárias para comparação: sem acentos, maiúsculas,
 * espaços colapsados. Bancos variam acentuação e espaçamento entre exportações
 * do mesmo lançamento, então é esta forma que vai para regras e deduplicação.
 */
export function normalizeText(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toUpperCase()
		.replace(/[^A-Z0-9*]+/g, ' ')
		.trim();
}

/**
 * Remove ruído que muda a cada ocorrência do mesmo estabelecimento
 * (datas, parcelas, números de autenticação), para aprender categorias por histórico.
 * Ex.: `UBER *TRIP 12/10 3F9K2` → `UBER *TRIP`
 */
export function merchantKey(description: string): string {
	return normalizeText(description)
		.replace(/\b\d{1,2} ?\/ ?\d{1,2}(\/\d{2,4})?\b/g, ' ')
		.replace(/\bPARC(ELA)?\s*\d+\s*(DE)?\s*\d*\b/g, ' ')
		.replace(/\b[A-Z0-9]*\d[A-Z0-9]*\b/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Deixa descrições em caixa alta mais legíveis (`PAG*FARMACIA SAO JOAO` → `Pag*Farmacia Sao Joao`).
 * Mantém intactas descrições que já usam caixa mista.
 */
export function prettifyDescription(s: string): string {
	const trimmed = s.replace(/\s+/g, ' ').trim();
	if (trimmed !== trimmed.toUpperCase()) return trimmed;
	return trimmed
		.toLowerCase()
		.replace(/(^|[\s*/\-.])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

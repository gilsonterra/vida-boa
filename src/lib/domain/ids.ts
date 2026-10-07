/**
 * UUID determinístico (formato v8) a partir de um texto. Usado quando dois aparelhos
 * precisam gerar o MESMO registro de forma independente, como a ocorrência de um lançamento
 * recorrente num dia: com o mesmo id, a sincronização junta os dois em vez de duplicar.
 * Não é criptográfico; só precisa ser estável e bem espalhado.
 */
export function stableUuid(input: string): string {
	// Quatro FNV-1a de 32 bits com sementes diferentes = 128 bits.
	const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
	const parts = seeds.map((seed) => {
		let h = seed >>> 0;
		for (let i = 0; i < input.length; i++) {
			h ^= input.charCodeAt(i);
			h = Math.imul(h, 0x01000193) >>> 0;
			// `^` devolve inteiro com sinal: sem o `>>> 0`, o hex sairia negativo ("-20b4bcf").
			h = (h ^ (h >>> 13)) >>> 0;
		}
		return h.toString(16).padStart(8, '0');
	});
	const hex = parts.join('');
	// Versão 8 (UUID "personalizado") e variante RFC 4122.
	const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (id: string) => UUID.test(id);

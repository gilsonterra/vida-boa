import { describe, expect, it } from 'vitest';
import { stableUuid } from './ids';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('stableUuid', () => {
	it('sempre gera um UUID válido (o Postgres recusa qualquer outro formato)', () => {
		for (let i = 0; i < 5000; i++) expect(stableUuid(`loan:${i}:${i % 37}`)).toMatch(UUID);
	});

	it('é estável', () => {
		expect(stableUuid('recurring:abc:2026-10-07')).toBe(stableUuid('recurring:abc:2026-10-07'));
	});
});

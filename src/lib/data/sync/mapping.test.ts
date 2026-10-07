import { describe, expect, it } from 'vitest';
import { fromRemote, toRemote } from './mapping';

describe('mapeamento da sincronização', () => {
	it('sobe só colunas conhecidas e nunca troca o dono', () => {
		const row = {
			id: 'a',
			createdAt: 'x',
			updatedAt: 'y',
			deletedAt: null,
			name: 'Mercado',
			kind: 'expense',
			icon: 'basket',
			color: '#000',
			isSystem: true,
			userId: 'outra-pessoa',
			user_id: 'outra-pessoa',
			campoEstranho: 1
		};
		const out = toRemote('categories', row, 'eu');
		expect(out.user_id).toBe('eu');
		expect(out).not.toHaveProperty('campo_estranho');
		expect(out).toMatchObject({ id: 'a', is_system: true, name: 'Mercado' });
	});

	it('normaliza timestamps do Postgres e ignora colunas desconhecidas', () => {
		const { row, serverUpdatedAt } = fromRemote('transactions', {
			id: 'b',
			user_id: 'eu',
			amount_cents: -100,
			created_at: '2026-10-07T03:00:00+00:00',
			updated_at: '2026-10-07T03:00:00.123+00:00',
			deleted_at: null,
			server_updated_at: '2026-10-07T03:00:01+00:00',
			coluna_nova: 'x'
		});
		expect(row).toEqual({
			id: 'b',
			amountCents: -100,
			createdAt: '2026-10-07T03:00:00.000Z',
			updatedAt: '2026-10-07T03:00:00.123Z',
			deletedAt: null
		});
		expect(serverUpdatedAt).toBe('2026-10-07T03:00:01+00:00');
	});
});

import { addDays, addMonths, monthKey, today } from '../domain/dates';
import { defaultConsolidated } from '../domain/ledger';
import type { DataStore } from './repositories';

/**
 * Popula o app com seis meses de movimentação plausível, para conhecer as telas
 * sem importar nada. Usa só a API pública do `DataStore`.
 */
export async function loadDemoData(store: DataStore) {
	const types = await store.accountTypes.list();
	const categories = await store.categories.list();
	const typeId = (kind: string) => types.find((t) => t.kind === kind)!.id;
	const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null;

	const base = { currency: 'BRL' as const, archived: false, ofxBankId: null, ofxAccountId: null };
	const checking = await store.accounts.create({
		...base,
		name: 'Itaú Personnalité',
		typeId: typeId('checking'),
		institution: 'Itaú',
		color: '#3e5c76',
		initialBalanceCents: 4_850_000
	});
	const card = await store.accounts.create({
		...base,
		name: 'Cartão Infinite',
		typeId: typeId('credit_card'),
		institution: 'Itaú',
		color: '#5a3e36',
		initialBalanceCents: 0
	});
	const invest = await store.accounts.create({
		...base,
		name: 'Carteira XP',
		typeId: typeId('investment'),
		institution: 'XP Investimentos',
		color: '#b08a3e',
		initialBalanceCents: 38_200_000
	});

	const end = today();
	const start = addMonths(`${monthKey(end)}-01`, -5);
	// Gerador determinístico, para a demonstração ser sempre igual.
	let seed = 7;
	const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
	const around = (cents: number, spread = 0.35) =>
		Math.round(cents * (1 - spread / 2 + rand() * spread));

	const tx = (
		accountId: string,
		date: string,
		amountCents: number,
		description: string,
		category: string | null
	) =>
		store.transactions.create({
			accountId,
			date,
			amountCents,
			description,
			notes: '',
			kind: amountCents < 0 ? 'expense' : 'income',
			categoryId: category ? cat(category) : null,
			transferId: null,
			fitId: null,
			importBatchId: null,
			recurringId: null,
			consolidated: defaultConsolidated(date, today())
		});

	const cardSpend: Array<[string, string, number]> = [
		['Fasano Jardins', 'Restaurantes', 68_000],
		['Evvai', 'Restaurantes', 92_000],
		['Mocotó', 'Restaurantes', 21_000],
		['St Marche', 'Mercado', 64_000],
		['Eataly', 'Mercado', 38_000],
		['Uber *Trip', 'Transporte', 4_800],
		['Shell Select', 'Combustível', 42_000],
		['Drogasil', 'Farmácia', 18_000],
		['Livraria da Vila', 'Lazer & Cultura', 26_000],
		['Sala São Paulo', 'Lazer & Cultura', 54_000],
		['Osklen', 'Vestuário', 128_000],
		['Iguatemi Estacionamento', 'Transporte', 3_200],
		['iFood', 'Delivery', 14_500],
		['Bio Ritmo', 'Bem-estar & Beleza', 49_900],
		['Netflix', 'Assinaturas', 5_990],
		['Spotify', 'Assinaturas', 3_490],
		['Latam Airlines', 'Viagens', 380_000]
	];

	for (let m = 0; m < 6; m++) {
		const first = addMonths(start, m);
		const day = (d: number) => addDays(first, d - 1);
		const inRange = (d: string) => d <= end;

		if (inRange(day(5)))
			await tx(
				checking.id,
				day(5),
				around(3_850_000, 0.02),
				'Pró-labore',
				'Pró-labore & Distribuição'
			);
		if (inRange(day(10))) await tx(checking.id, day(10), -1_250_000, 'Aluguel Jardins', 'Moradia');
		if (inRange(day(10)))
			await tx(checking.id, day(10), -284_000, 'Condomínio Ed. Paulista', 'Moradia');
		if (inRange(day(12))) await tx(checking.id, day(12), -around(42_000), 'Enel', 'Moradia');
		if (inRange(day(15)))
			await tx(checking.id, day(15), -398_000, 'Colégio Santa Cruz', 'Educação');
		if (inRange(day(20)))
			await tx(checking.id, day(20), -around(186_000, 0.1), 'Bradesco Saúde', 'Saúde');
		if (inRange(day(16)))
			await tx(invest.id, day(16), around(210_000), 'Dividendos ITSA4', 'Dividendos');
		if (inRange(day(28)))
			await tx(invest.id, day(28), around(160_000, 0.2), 'Rendimento CDB', 'Rendimentos');

		let invoice = 0;
		const count = 16 + Math.floor(rand() * 8);
		for (let i = 0; i < count; i++) {
			const date = day(1 + Math.floor(rand() * 27));
			if (!inRange(date)) continue;
			const [desc, category, cents] = pick(cardSpend);
			if (desc === 'Latam Airlines' && rand() < 0.7) continue;
			const value = around(cents);
			invoice += value;
			await tx(card.id, date, -value, desc, category);
		}

		// Pagamento da fatura (transferência corrente → cartão) e aporte nos investimentos.
		const payDay = addDays(first, 34);
		if (inRange(payDay) && invoice > 0) {
			await store.transactions.createTransfer({
				fromAccountId: checking.id,
				toAccountId: card.id,
				amountCents: invoice,
				date: payDay,
				description: 'Pagamento fatura Infinite',
				notes: ''
			});
		}
		if (inRange(day(6))) {
			await store.transactions.createTransfer({
				fromAccountId: checking.id,
				toAccountId: invest.id,
				amountCents: 800_000,
				date: day(6),
				description: 'Aporte mensal',
				notes: ''
			});
		}
	}

	await store.recurring.create({
		description: 'Aluguel Jardins',
		accountId: checking.id,
		categoryId: cat('Moradia'),
		kind: 'expense',
		amountCents: 1_250_000,
		frequency: 'monthly',
		startDate: addMonths(start, 6).slice(0, 8) + '10',
		endDate: null,
		nextDate: addMonths(start, 6).slice(0, 8) + '10',
		active: true
	});
}

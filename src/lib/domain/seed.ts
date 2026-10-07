import type { AccountKind, CategoryKind, MatchType } from './types';

/**
 * Paleta editorial para categorias e contas: tons terrosos e profundos que
 * convivem com o fundo marfim e com o tema escuro sem gritar.
 */
export const PALETTE = [
	'#2f5d46', // verde-inglês
	'#8a5a3b', // conhaque
	'#b08a3e', // ocre dourado
	'#3e5c76', // azul petróleo
	'#7a4b6b', // ameixa
	'#a3543f', // terracota
	'#5b6b4e', // oliva
	'#4a4e69', // ardósia
	'#9c6b6b', // rosé antigo
	'#2e6f73', // verde-azulado
	'#6d5c49', // tabaco
	'#5a3e36' // café
] as const;

export const SEED_ACCOUNT_TYPES: Array<{ name: string; kind: AccountKind }> = [
	{ name: 'Conta corrente', kind: 'checking' },
	{ name: 'Poupança', kind: 'savings' },
	{ name: 'Cartão de crédito', kind: 'credit_card' },
	{ name: 'Investimentos', kind: 'investment' },
	{ name: 'Dinheiro', kind: 'cash' }
];

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
	checking: 'Conta corrente',
	savings: 'Poupança',
	credit_card: 'Cartão de crédito',
	investment: 'Investimento',
	cash: 'Dinheiro',
	other: 'Outro'
};

interface SeedCategory {
	name: string;
	kind: CategoryKind;
	icon: string;
	color: string;
}

export const SEED_CATEGORIES: SeedCategory[] = [
	// Despesas
	{ name: 'Moradia', kind: 'expense', icon: 'home', color: PALETTE[3] },
	{ name: 'Casa & Manutenção', kind: 'expense', icon: 'wrench', color: PALETTE[10] },
	{ name: 'Mercado', kind: 'expense', icon: 'basket', color: PALETTE[6] },
	{ name: 'Restaurantes', kind: 'expense', icon: 'utensils', color: PALETTE[5] },
	{ name: 'Delivery', kind: 'expense', icon: 'bike', color: PALETTE[1] },
	{ name: 'Transporte', kind: 'expense', icon: 'car', color: PALETTE[7] },
	{ name: 'Combustível', kind: 'expense', icon: 'fuel', color: PALETTE[11] },
	{ name: 'Viagens', kind: 'expense', icon: 'plane', color: PALETTE[9] },
	{ name: 'Saúde', kind: 'expense', icon: 'heart-pulse', color: PALETTE[5] },
	{ name: 'Farmácia', kind: 'expense', icon: 'pill', color: PALETTE[8] },
	{ name: 'Bem-estar & Beleza', kind: 'expense', icon: 'sparkles', color: PALETTE[4] },
	{ name: 'Educação', kind: 'expense', icon: 'graduation', color: PALETTE[3] },
	{ name: 'Filhos', kind: 'expense', icon: 'baby', color: PALETTE[2] },
	{ name: 'Pets', kind: 'expense', icon: 'paw', color: PALETTE[10] },
	{ name: 'Lazer & Cultura', kind: 'expense', icon: 'ticket', color: PALETTE[4] },
	{ name: 'Compras', kind: 'expense', icon: 'bag', color: PALETTE[1] },
	{ name: 'Vestuário', kind: 'expense', icon: 'shirt', color: PALETTE[8] },
	{ name: 'Assinaturas', kind: 'expense', icon: 'repeat', color: PALETTE[7] },
	{ name: 'Presentes & Doações', kind: 'expense', icon: 'gift', color: PALETTE[2] },
	{ name: 'Seguros', kind: 'expense', icon: 'shield', color: PALETTE[9] },
	{ name: 'Impostos & Taxas', kind: 'expense', icon: 'landmark', color: PALETTE[11] },
	{ name: 'Tarifas bancárias', kind: 'expense', icon: 'receipt', color: PALETTE[7] },
	{ name: 'Financiamentos', kind: 'expense', icon: 'hand-coins', color: PALETTE[11] },
	{ name: 'Outras despesas', kind: 'expense', icon: 'circle', color: PALETTE[10] },
	// Receitas
	{ name: 'Salário', kind: 'income', icon: 'briefcase', color: PALETTE[0] },
	{ name: 'Pró-labore & Distribuição', kind: 'income', icon: 'building', color: PALETTE[9] },
	{ name: 'Rendimentos', kind: 'income', icon: 'trending-up', color: PALETTE[2] },
	{ name: 'Dividendos', kind: 'income', icon: 'coins', color: PALETTE[6] },
	{ name: 'Aluguéis recebidos', kind: 'income', icon: 'key', color: PALETTE[3] },
	{ name: 'Freelance & Consultoria', kind: 'income', icon: 'pen', color: PALETTE[4] },
	{ name: 'Reembolsos', kind: 'income', icon: 'undo', color: PALETTE[1] },
	{ name: 'Outras receitas', kind: 'income', icon: 'circle', color: PALETTE[0] }
];

/** Regras iniciais (por nome de categoria). Cobrem os estabelecimentos mais comuns no Brasil. */
const BASE_RULES: Array<{ pattern: string; matchType: MatchType; category: string }> = [
	...[
		'UBER',
		'99APP',
		'99 POP',
		'99 TAXI',
		'CABIFY',
		'SEM PARAR',
		'CONECTCAR',
		'ESTAPAR',
		'ZUL'
	].map((p) => ({ pattern: p, matchType: 'contains' as const, category: 'Transporte' })),
	...['IFOOD', 'IFD*', 'RAPPI', 'ZE DELIVERY', 'AIQFOME'].map((p) => ({
		pattern: p,
		matchType: 'contains' as const,
		category: 'Delivery'
	})),
	...['POSTO', 'SHELL', 'IPIRANGA', 'PETROBRAS', 'AUTO POSTO', 'BR MANIA'].map((p) => ({
		pattern: p,
		matchType: 'contains' as const,
		category: 'Combustível'
	})),
	...['DROGASIL', 'DROGA RAIA', 'RAIA', 'DROGARIA', 'FARMACIA', 'PAGUE MENOS', 'PANVEL'].map(
		(p) => ({
			pattern: p,
			matchType: 'contains' as const,
			category: 'Farmácia'
		})
	),
	...[
		'PAO DE ACUCAR',
		'ST MARCHE',
		'CARREFOUR',
		'ZONA SUL',
		'HORTIFRUTI',
		'OXXO',
		'SUPERMERCADO',
		'EATALY'
	].map((p) => ({ pattern: p, matchType: 'contains' as const, category: 'Mercado' })),
	...[
		'NETFLIX',
		'SPOTIFY',
		'DISNEY',
		'HBO',
		'MAX.COM',
		'PRIME VIDEO',
		'AMAZON PRIME',
		'APPLE.COM',
		'GOOGLE ONE',
		'YOUTUBE',
		'GLOBOPLAY',
		'DEEZER',
		'CHATGPT',
		'OPENAI',
		'CLAUDE.AI',
		'ANTHROPIC'
	].map((p) => ({ pattern: p, matchType: 'contains' as const, category: 'Assinaturas' })),
	...['LATAM', 'GOL LINHAS', 'AZUL LINHAS', 'AIRBNB', 'BOOKING', 'HOTEL', 'DECOLAR', 'TAP AIR'].map(
		(p) => ({
			pattern: p,
			matchType: 'contains' as const,
			category: 'Viagens'
		})
	),
	...['SMART FIT', 'BODYTECH', 'BIO RITMO', 'WELLHUB', 'GYMPASS', 'SALAO', 'BARBEARIA', 'SPA'].map(
		(p) => ({
			pattern: p,
			matchType: 'contains' as const,
			category: 'Bem-estar & Beleza'
		})
	),
	...[
		'UNIMED',
		'BRADESCO SAUDE',
		'SULAMERICA',
		'AMIL',
		'HOSPITAL',
		'LABORATORIO',
		'FLEURY',
		'DASA',
		'CLINICA'
	].map((p) => ({ pattern: p, matchType: 'contains' as const, category: 'Saúde' })),
	...['IPTU', 'IPVA', 'DARF', 'IOF', 'RECEITA FEDERAL'].map((p) => ({
		pattern: p,
		matchType: 'contains' as const,
		category: 'Impostos & Taxas'
	})),
	...['TARIFA', 'ANUIDADE', 'CESTA DE SERVICOS', 'MENSALIDADE PACOTE'].map((p) => ({
		pattern: p,
		matchType: 'contains' as const,
		category: 'Tarifas bancárias'
	})),
	...[
		'ENEL',
		'LIGHT',
		'CEMIG',
		'COPEL',
		'SABESP',
		'CEDAE',
		'COMGAS',
		'NATURGY',
		'CONDOMINIO',
		'ALUGUEL',
		'VIVO',
		'CLARO',
		'TIM ',
		'NET SERVICOS'
	].map((p) => ({ pattern: p, matchType: 'contains' as const, category: 'Moradia' })),
	...['SALARIO', 'PAGTO SALARIO', 'PROVENTOS'].map((p) => ({
		pattern: p,
		matchType: 'contains' as const,
		category: 'Salário'
	})),
	...['DIVIDENDO', 'JCP', 'JUROS S/CAPITAL', 'JUROS SOBRE CAPITAL'].map((p) => ({
		pattern: p,
		matchType: 'contains' as const,
		category: 'Dividendos'
	})),
	...['RENDIMENTO', 'REND PAGO', 'RENDE FACIL', 'CDB'].map((p) => ({
		pattern: p,
		matchType: 'contains' as const,
		category: 'Rendimentos'
	})),
	...['ESTORNO', 'REEMBOLSO', 'CASHBACK'].map((p) => ({
		pattern: p,
		matchType: 'contains' as const,
		category: 'Reembolsos'
	}))
];

/**
 * Regras da versão 2, levantadas de extratos reais (Nubank). Os nomes chegam truncados em
 * ~22 caracteres no cartão ("SUPERMERCA", "COMBUSTIVEI"), por isso vários padrões são radicais.
 * Padrões com 4+ letras casam em qualquer ponto da palavra; com menos, só a palavra inteira.
 */
const EXTRA_RULES: Record<string, string[]> = {
	Restaurantes: [
		'GRELHADO',
		'CANTINHO',
		'HABIB',
		'CHOCOLATE',
		'CERVEJARIA',
		'CACHACARIA',
		'CASEIRO',
		'SABOR',
		'RESTAURANTE',
		'RESTAURAN',
		'ESPETINHO',
		'ESPETO',
		'CHURRASC',
		'GASTRO',
		'GRILL',
		'BAR',
		'CHOPP',
		'CHOPERIA',
		'PETISCARIA',
		'MARMITA',
		'PAMONHARIA',
		'ACAI',
		'ACAITERIA',
		'ESFIHA',
		'PIZZA',
		'BURGER',
		'BURGUER',
		'HAMBURG',
		'SMASH',
		'SANDUICH',
		'LANCHONETE',
		'LANCHES',
		'PADARIA',
		'PANIFICADORA',
		'CONFEITARIA',
		'DOCERIA',
		'SORVETE',
		'SORVETERIA',
		'CAFETERIA',
		'COMIDA',
		'CARNE DE SOL',
		'MC DONALDS',
		'MCDONALDS',
		'BURGER KING',
		'OUTBACK',
		'SUBWAY',
		'HABIBS',
		'COCO BAMBU',
		'STARBUCKS',
		'SPOLETO'
	],
	Mercado: [
		'CARNES',
		'ATACAREJ',
		'BEBID',
		'ALIMENTOS',
		'SUPERMERC',
		'ATACADAO',
		'ATACAREJO',
		'ATAKAREJO',
		'ATACADISTA',
		'CENCOSUD',
		'ASSAI',
		'HIPERMERC',
		'MERCEARIA',
		'EMPORIO',
		'HORTIFRUT',
		'SACOLAO',
		'ACOUGUE',
		'BEBIDAS',
		'GRAOS',
		'NATURAIS'
	],
	Compras: [
		'RELOJOARIA',
		'BORDADOS',
		'PRESENTES',
		'AMAZON',
		'MERCADOLIVRE',
		'MERCADO LIVRE',
		'SHOPEE',
		'SHPP',
		'ALIEXPRESS',
		'SHEIN',
		'MAGALU',
		'MAGAZINE LUIZA',
		'CASAS BAHIA',
		'AMERICANAS',
		'KABUM',
		'DECATHLON',
		'SHOPPING'
	],
	Delivery: ['DELIVERY'],
	Assinaturas: [
		'SOFTWARE',
		'MELIMAIS',
		'AMAZON DIGITAL',
		'AMAZON PRIME',
		'PRIMEVIDEO',
		'KINDLE',
		'ICLOUD'
	],
	Vestuário: [
		'RENNER',
		'RIACHUELO',
		'PERNAMBUCANAS',
		'MARISA',
		'ZARA',
		'HERING',
		'CENTAURO',
		'NETSHOES',
		'CALCADOS',
		'SANDALIAS',
		'MODAS',
		'FILA BR'
	],
	Filhos: ['KIDS', 'RI HAPPY', 'BRINQUEDOS', 'TOYS', 'PBKIDS'],
	'Casa & Manutenção': [
		'PAISAGISMO',
		'ASSISTENCIA TECNICA',
		'KACTUS',
		'MATERIA',
		'MATERIAIS',
		'MAT CONSTR',
		'CONSTRUCAO',
		'LEROY MERLIN',
		'TELHANORTE',
		'UTILIDADES',
		'ENXOV',
		'ELETRICA',
		'FERRAGENS',
		'TINTAS'
	],
	Transporte: [
		'PARKING',
		'CONCEBRA',
		'PEDAGIO',
		'ECORODOVIAS',
		'ECOVIAS',
		'ARTERIS',
		'ESTACIONAM',
		'AUTO CENTER',
		'AUTOCENTER',
		'MECANICA',
		'PNEUS',
		'AUTO PECAS',
		'LAVA JATO',
		'LAVAJATO'
	],
	Combustível: ['COMBUSTIV', 'POSTO'],
	Moradia: [
		'TELECOM',
		'RECARGA DE CELULAR',
		'EQUATORIAL',
		'ENERGISA',
		'NEOENERGIA',
		'CELESC',
		'COELBA',
		'CPFL',
		'ELEKTRO',
		'SANEAGO',
		'SANESC',
		'SANEAMENTO',
		'COPASA',
		'EMBASA',
		'SANEPAR'
	],
	Financiamentos: [
		'FINANCIAMENTO',
		'HABITACAO',
		'SANTANDER AUTO',
		'BV FINANCEIRA',
		'AYMORE',
		'EMPRESTIMO',
		'CONSORCIO'
	],
	'Impostos & Taxas': [
		'DETRAN',
		'DEPARTAMENTO ESTADUAL DE TRANSITO',
		'LICENCIAMENTO',
		'JUROS',
		'ENCARGOS'
	],
	Farmácia: ['RD SAUDE', 'FARMA', 'DROGA'],
	Saúde: ['PRONTO SOCORRO', 'PRONTOSOCORRO', 'ODONTO', 'OTICA', 'EXAMES'],
	Pets: ['PET SHOP', 'PETSHOP', 'PETZ', 'COBASI', 'VETERINAR'],
	'Lazer & Cultura': [
		'LIVRARIA',
		'LEITURA',
		'PAGINAS',
		'FESTA',
		'RECREATIVAS',
		'ZIGPAY',
		'CINEMA',
		'CINEMARK',
		'INGRESSO',
		'SYMPLA',
		'TEATRO'
	],
	Reembolsos: ['DESCONTO ANTECIP']
};

export const SEED_RULES: Array<{ pattern: string; matchType: MatchType; category: string }> = [
	...BASE_RULES,
	...Object.entries(EXTRA_RULES).flatMap(([category, patterns]) =>
		patterns.map((pattern) => ({ pattern, matchType: 'contains' as const, category }))
	)
];

/** Versão dos dados iniciais; ao subir, instalações existentes recebem o que for novo. */
export const SEED_VERSION = 2;

/**
 * Movimentações de investimento na própria instituição (RDB, caixinha, aplicação/resgate):
 * o dinheiro muda de lugar mas continua seu, então vira transferência, não despesa/receita.
 */
export const INVESTMENT_MOVE_PATTERN =
	/\b(APLICACAO|RESGATE)\b|\bCAIXINHA\b|\bDINHEIRO (GUARDADO|RESGATADO)\b|\bRDB\b/;

/** Descrições que indicam pagamento de fatura (pista para virar transferência). */
export const CARD_PAYMENT_PATTERN =
	/\b(PAGAMENTO|PAGTO|PGTO|PAG)\b.*\b(FATURA|CARTAO|RECEBIDO)\b|\bPAGAMENTO RECEBIDO\b|\bFATURA\b.*\bPAG/;

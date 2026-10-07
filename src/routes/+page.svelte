<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ArrowDown,
		ArrowUpRight,
		CloudCheck,
		CloudOff,
		Eye,
		EyeOff,
		FileUp,
		LoaderCircle,
		Plus,
		TriangleAlert
	} from '@lucide/svelte';
	import { addDays, formatDayShort, monthKey, monthRange, today } from '#lib/domain/dates.ts';
	import { upcomingDates } from '#lib/domain/recurrence.ts';
	import {
		chartMonths,
		inMonth,
		KIND_GROUPS,
		netWorthSeries,
		summarize
	} from '#lib/domain/reports.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { cloud } from '#lib/stores/sync.svelte.ts';
	import { openEditor, togglePrivacy, ui } from '#lib/stores/ui.svelte.ts';
	import AccountEditor from '#lib/ui/AccountEditor.svelte';
	import Amount from '#lib/ui/Amount.svelte';
	import Button from '#lib/ui/Button.svelte';
	import FlowFigure from '#lib/ui/FlowFigure.svelte';
	import Trend from '#lib/ui/Trend.svelte';
	import LineChart from '#lib/ui/charts/LineChart.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import { ACCOUNT_KIND_ICON } from '#lib/ui/icons.ts';
	import Segmented from '#lib/ui/Segmented.svelte';
	import TransactionRow from '#lib/ui/TransactionRow.svelte';
	import CategoryMark from '#lib/ui/CategoryMark.svelte';
	import { dragScroll } from '#lib/ui/drag-scroll.ts';
	import { MediaQuery } from 'svelte/reactivity';

	const data = useAppData();
	const now = today();
	const thisMonth = monthKey(now);
	let newAccountOpen = $state(false);
	/** Telas largas: duas colunas, com o gráfico grande à direita. */
	const wide = new MediaQuery('min-width: 1100px');

	const visibleAccounts = $derived(data.activeAccounts);
	const visibleTx = $derived.by(() => {
		const ids = new Set(visibleAccounts.map((a) => a.id));
		return data.transactions.filter((t) => ids.has(t.accountId));
	});

	// Saldo devedor dos financiamentos entra como dívida.
	const netWorth = $derived(
		visibleAccounts.reduce((s, a) => s + (data.balances.get(a.id) ?? 0), 0) - data.debtAt(now)
	);
	/** Patrimônio no fim de cada mês, descontando a dívida da época (o mês atual vai até hoje). */
	function withDebt(points: Array<{ month: string; totalCents: number }>) {
		return points.map((p) => {
			const end = monthRange(p.month).end;
			return { ...p, totalCents: p.totalCents - data.debtAt(end < now ? end : now) };
		});
	}
	/** Período do gráfico, em meses ('all' = desde o primeiro lançamento). */
	type Range = '3' | '6' | '12' | 'all';
	let range = $state<Range>('6');
	const RANGES: Array<{ value: Range; label: string }> = [
		{ value: '3', label: '3M' },
		{ value: '6', label: '6M' },
		{ value: '12', label: '1A' },
		{ value: 'all', label: 'Tudo' }
	];
	const months = $derived(
		range === 'all'
			? chartMonths(visibleTx, thisMonth, 600, 2)
			: chartMonths(visibleTx, thisMonth, Number(range), Number(range))
	);
	const series = $derived(withDebt(netWorthSeries(visibleAccounts, visibleTx, months)));
	/** Variação do mês atual, independente do período escolhido no gráfico. */
	const lastTwo = $derived(
		withDebt(netWorthSeries(visibleAccounts, visibleTx, chartMonths(visibleTx, thisMonth, 2, 2)))
	);
	const monthDelta = $derived(
		lastTwo.length > 1 ? lastTwo[1].totalCents - lastTwo[0].totalCents : 0
	);
	const month = $derived(summarize(inMonth(visibleTx, thisMonth)));
	const recent = $derived(visibleTx.slice(0, 6));

	/** Contas na ordem dos grupos (contas, cartões, investimentos...), para o carrossel. */
	const orderedAccounts = $derived(
		KIND_GROUPS.flatMap((g) => visibleAccounts.filter((a) => g.kinds.includes(data.kindOf(a.id))))
	);

	/** Primeiro nome a partir do e-mail ("maria.silva@..." → "Maria"). */
	const firstName = $derived.by(() => {
		const local = cloud.user?.email?.split('@')[0] ?? '';
		const first = local.split(/[._\-+0-9]/).find(Boolean) ?? '';
		return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : '';
	});

	/** Recorrências que vencem nas próximas duas semanas. */
	const upcoming = $derived(
		data.recurring
			.filter((r) => r.active)
			.flatMap((r) => upcomingDates(r, 3).map((date) => ({ rule: r, date })))
			.filter((u) => u.date <= addDays(now, 14))
			.sort((a, b) => a.date.localeCompare(b.date))
			.slice(0, 4)
	);

	const cloudLabel = $derived(
		cloud.status === 'syncing'
			? 'Sincronizando'
			: cloud.status === 'offline'
				? 'Sem internet; sincroniza quando voltar'
				: cloud.status === 'error'
					? 'Erro ao sincronizar'
					: 'Sincronizado'
	);

	const greeting = (() => {
		const h = new Date().getHours();
		return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
	})();
</script>

{#snippet topBar()}
	<div class="top">
		<div class="hello">
			<span class="avatar" aria-hidden="true">{firstName ? firstName[0] : 'V'}</span>
			<span>
				<small>{greeting},</small>
				<strong>{firstName || 'Vida Boa'}</strong>
			</span>
		</div>
		<span class="top-actions">
			<IconButton
				tone="hi"
				label={ui.privacy ? 'Mostrar valores' : 'Ocultar valores'}
				onclick={togglePrivacy}
			>
				{#if ui.privacy}<EyeOff size={20} strokeWidth={1.8} />{:else}<Eye
						size={20}
						strokeWidth={1.8}
					/>{/if}
			</IconButton>
			{#if cloud.user}
				<IconButton tone="strong" label={cloudLabel} href={resolve('/ajustes')}>
					{#if cloud.status === 'syncing'}<LoaderCircle size={20} strokeWidth={1.8} class="spin" />
					{:else if cloud.status === 'offline'}<CloudOff size={20} strokeWidth={1.8} />
					{:else if cloud.status === 'error'}<TriangleAlert size={20} strokeWidth={1.8} />
					{:else}<CloudCheck size={20} strokeWidth={1.8} />{/if}
				</IconButton>
			{/if}
		</span>
	</div>
{/snippet}

<div class="page pt-safe" class:wide={data.accounts.length > 0}>
	{#if data.ready && data.accounts.length === 0}
		{@render topBar()}
		<section class="welcome">
			<h1>Tudo o que é seu, num só lugar.</h1>
			<p class="lead">
				Cadastre suas contas e cartões, importe os extratos do banco e veja seu patrimônio tomar
				forma.
			</p>
			<div class="cta">
				<Button size="lg" onclick={() => (newAccountOpen = true)}>Cadastrar primeira conta</Button>
				<Button size="lg" variant="secondary" href={resolve('/importar')}
					><FileUp size={18} strokeWidth={1.8} />Importar extrato</Button
				>
			</div>
		</section>
	{:else if data.ready}
		<div class="dash">
			<div class="side">
				{@render topBar()}
				<section class="hero">
					<p class="label">Patrimônio</p>
					<Amount cents={netWorth} size="xl" tone="auto" />
					<p class="delta">
						<Trend cents={monthDelta}
							>{monthDelta === 0 ? 'sem variação no mês' : 'neste mês'}</Trend
						>
					</p>
				</section>
				<section class="quick" aria-label="Atalhos">
					<button type="button" onclick={() => openEditor({ defaults: { kind: 'expense' } })}>
						<span class="q-ico"><Plus size={22} strokeWidth={1.8} /></span>Lançar
					</button>
					<a href={resolve('/importar')}>
						<span class="q-ico"><ArrowDown size={22} strokeWidth={1.8} /></span>Importar
					</a>
					<button type="button" onclick={() => openEditor({ defaults: { kind: 'transfer' } })}>
						<span class="q-ico"><ArrowUpRight size={22} strokeWidth={1.8} /></span>Transferir
					</button>
				</section>
				<section class="month">
					<a href={resolve('/extrato')} class="cell">
						<FlowFigure kind="in" cents={month.incomeCents} label="Entradas no mês" />
					</a>
					<a href={resolve('/extrato')} class="cell">
						<FlowFigure kind="out" cents={month.expenseCents} label="Saídas no mês" />
					</a>
				</section>
			</div>
			<div class="col">
				<section class="chart">
					<LineChart points={series} height={wide.current ? 320 : 200} />
					<div class="ranges">
						<Segmented options={RANGES} bind:value={range} label="Período do gráfico" />
					</div>
				</section>

				<section class="block">
					<header>
						<h2>Suas contas</h2>
						<a href={resolve('/contas')} class="link">Gerenciar</a>
					</header>
					<!-- Carrossel de cartões: a primeira conta em destaque, como um cartão físico. -->
					<ul class="cards no-scrollbar" use:dragScroll>
						{#each orderedAccounts as a, i (a.id)}
							{@const Icon = ACCOUNT_KIND_ICON[data.kindOf(a.id)]}
							<li>
								<a class="card" class:first={i === 0} href={resolve('/contas/[id]', { id: a.id })}>
									<span class="card-top">
										<strong>{a.name}</strong>
										<span class="card-ico"><Icon size={20} strokeWidth={1.8} /></span>
									</span>
									<span class="card-bottom">
										<small>{a.institution || 'Saldo'}</small>
										<Amount cents={data.balances.get(a.id) ?? 0} size="lg" tone="debt" />
									</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>

				{#if upcoming.length}
					<section class="block">
						<header>
							<h2>Próximos lançamentos</h2>
							<a href={resolve('/recorrentes')} class="link">Recorrentes</a>
						</header>
						<ul>
							{#each upcoming as u (u.rule.id + u.date)}
								<li class="row">
									<CategoryMark
										category={u.rule.categoryId
											? data.categoryById.get(u.rule.categoryId)
											: undefined}
									/>
									<span class="main">
										<span class="title">{u.rule.description}</span>
										<small>{u.date === now ? 'Hoje' : formatDayShort(u.date)}</small>
									</span>
									<Amount
										cents={u.rule.kind === 'expense' ? -u.rule.amountCents : u.rule.amountCents}
										size="sm"
										signed
										tone="auto"
									/>
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				<section class="block">
					<header>
						<h2>Últimos lançamentos</h2>
						<a href={resolve('/extrato')} class="link">Ver tudo</a>
					</header>
					{#if recent.length}
						<div>
							{#each recent as t (t.id)}<TransactionRow transaction={t} />{/each}
						</div>
					{:else}
						<p class="muted">
							Nenhum lançamento ainda. Use o botão + para lançar ou importar um extrato.
						</p>
					{/if}
				</section>
			</div>
		</div>
	{/if}
</div>

<AccountEditor bind:open={newAccountOpen} />

<style>
	.page {
		padding-inline: 20px;
	}
	/* Celular: uma coluna só, com o gráfico logo abaixo do patrimônio. */
	.dash {
		display: flex;
		flex-direction: column;
	}
	.side,
	.col {
		display: contents;
	}
	.dash :global(.top) {
		order: 0;
	}
	.hero {
		order: 1;
	}
	.chart {
		order: 2;
	}
	.quick {
		order: 3;
	}
	.month {
		order: 4;
	}
	.block {
		order: 5;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 72px;
	}
	.hello {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: 999px;
		background: var(--surface);
		box-shadow: 0 0 0 1px var(--rule);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 20px;
		color: var(--accent);
	}
	.hello small {
		display: block;
		font-size: 14px;
		color: var(--ink-2);
		line-height: 1.2;
	}
	.hello strong {
		display: block;
		font-size: 20px;
		font-weight: 700;
		color: var(--accent);
		line-height: 1.2;
	}
	/* Par de botões redondos encostados, como nas referências. */
	.top-actions {
		display: flex;
		align-items: center;
	}
	.top-actions :global(.icon-btn + .icon-btn) {
		margin-left: -6px;
		box-shadow: 0 0 0 3px var(--paper);
	}
	.top-actions :global(.spin) {
		animation: spin 900ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.hero {
		padding: 36px 0 4px;
		text-align: center;
	}
	.label {
		font-size: 13px;
		font-weight: 500;
		color: var(--ink-2);
		margin-bottom: 10px;
	}
	.delta {
		margin-top: 16px;
	}
	.chart {
		margin: 18px -20px 0;
	}
	.chart :global(.caption) {
		padding-inline: 20px;
	}
	.ranges {
		width: min(280px, 100%);
		margin: 14px auto 0;
	}
	.quick {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		margin-top: 28px;
	}
	.quick > * {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
	}
	.q-ico {
		display: grid;
		place-items: center;
		width: 100%;
		height: 64px;
		border-radius: 999px;
		background: var(--surface);
		box-shadow: var(--shadow-card);
		transition: transform 120ms;
	}
	.quick > *:active .q-ico {
		transform: scale(0.96);
	}
	.month {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-top: 24px;
	}
	.cell {
		padding: 16px;
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow-card);
	}
	.block {
		margin-top: 36px;
	}
	.block header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 14px;
	}
	h2 {
		font-size: 17px;
	}
	.link {
		font-size: 14px;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	/* Carrossel: cartões grandes que deslizam e param alinhados. */
	.cards {
		display: flex;
		gap: 12px;
		margin-inline: -20px;
		padding: 2px 20px 6px;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scroll-padding-inline: 20px;
	}
	.cards li {
		flex: 0 0 min(78%, 300px);
		scroll-snap-align: start;
	}
	.card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		height: 180px;
		padding: 20px 22px;
		border-radius: 24px;
		background: var(--surface);
		box-shadow: var(--shadow-card);
	}
	.card.first {
		background: var(--hi);
		color: var(--on-hi);
		--ink-2: color-mix(in oklab, var(--on-hi) 70%, transparent);
	}
	.card-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.card-top strong {
		font-size: 17px;
		font-weight: 700;
		line-height: 1.25;
	}
	.card-ico {
		opacity: 0.75;
	}
	.card-bottom {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.card-bottom small {
		font-size: 13px;
		font-weight: 500;
		color: var(--ink-2);
	}
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.title {
		font-weight: 600;
	}
	.main small {
		font-size: 13px;
		color: var(--ink-2);
	}
	.muted {
		color: var(--ink-2);
		padding: 12px 0;
	}
	.welcome {
		padding: 40px 0 24px;
	}
	.welcome h1 {
		font-size: clamp(38px, 11vw, 54px);
		color: var(--accent);
		max-width: 11ch;
	}
	.lead {
		margin-top: 18px;
		max-width: 40ch;
		color: var(--ink-2);
		font-size: 16px;
		line-height: 1.6;
	}
	.cta {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 32px;
		max-width: 360px;
	}

	/*
	 * Telas largas, como na referência: painel claro à esquerda com saldo, atalhos e o mês;
	 * à direita o gráfico grande (com os botões do topo no canto) e as listas.
	 */
	@media (min-width: 1100px) {
		.page.wide {
			padding-inline: 0;
		}
		.dash {
			position: relative;
			display: grid;
			grid-template-columns: 360px minmax(0, 1fr);
			gap: 24px;
			align-items: start;
		}
		.side,
		.col {
			display: block;
		}
		.side {
			position: sticky;
			top: 24px;
			padding: 12px 24px 24px;
			border-radius: 28px;
			background: var(--surface);
			box-shadow: var(--shadow-card);
		}
		.side :global(.amount-xl) {
			font-size: 52px;
		}
		.side .q-ico,
		.side .cell {
			background: var(--paper);
			box-shadow: none;
		}
		.side .month {
			grid-template-columns: 1fr;
		}
		.top-actions {
			position: absolute;
			top: 18px;
			right: 18px;
			z-index: 2;
		}
		.top-actions :global(.icon-btn + .icon-btn) {
			box-shadow: 0 0 0 3px var(--surface);
		}
		.chart {
			margin: 0;
			padding: 70px 0 20px;
			border-radius: 28px;
			overflow: hidden;
			background: var(--surface);
			box-shadow: var(--shadow-card);
		}
		.col .block {
			margin-top: 32px;
		}
	}
</style>

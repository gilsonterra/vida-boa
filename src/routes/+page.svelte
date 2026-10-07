<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ChevronRight,
		CloudCheck,
		CloudOff,
		Eye,
		EyeOff,
		FileUp,
		Gem,
		LoaderCircle,
		TriangleAlert
	} from '@lucide/svelte';
	import { addDays, formatDayShort, monthKey, today } from '#lib/domain/dates.ts';
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
	import { togglePrivacy, ui } from '#lib/stores/ui.svelte.ts';
	import AccountEditor from '#lib/ui/AccountEditor.svelte';
	import Amount from '#lib/ui/Amount.svelte';
	import Button from '#lib/ui/Button.svelte';
	import FlowFigure from '#lib/ui/FlowFigure.svelte';
	import Trend from '#lib/ui/Trend.svelte';
	import LineChart from '#lib/ui/charts/LineChart.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import { ACCOUNT_KIND_ICON } from '#lib/ui/icons.ts';
	import TransactionRow from '#lib/ui/TransactionRow.svelte';
	import CategoryMark from '#lib/ui/CategoryMark.svelte';

	const data = useAppData();
	const now = today();
	const thisMonth = monthKey(now);
	let newAccountOpen = $state(false);

	const visibleAccounts = $derived(data.activeAccounts);
	const visibleTx = $derived.by(() => {
		const ids = new Set(visibleAccounts.map((a) => a.id));
		return data.transactions.filter((t) => ids.has(t.accountId));
	});

	const netWorth = $derived(
		visibleAccounts.reduce((s, a) => s + (data.balances.get(a.id) ?? 0), 0)
	);
	const series = $derived(
		netWorthSeries(visibleAccounts, visibleTx, chartMonths(visibleTx, thisMonth))
	);
	const monthDelta = $derived(
		series.length > 1
			? series[series.length - 1].totalCents - series[series.length - 2].totalCents
			: 0
	);
	const month = $derived(summarize(inMonth(visibleTx, thisMonth)));
	const recent = $derived(visibleTx.slice(0, 6));

	const groups = $derived(
		KIND_GROUPS.map((g) => ({
			...g,
			accounts: visibleAccounts.filter((a) => g.kinds.includes(data.kindOf(a.id)))
		})).filter((g) => g.accounts.length > 0)
	);

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

<div class="page pt-safe">
	<div class="top">
		<span class="brand"><Gem size={22} strokeWidth={1.5} class="gem" />Vida Boa</span>
		<span class="top-actions">
			{#if cloud.user}
				<IconButton label={cloudLabel} href={resolve('/ajustes')}>
					{#if cloud.status === 'syncing'}<LoaderCircle size={19} strokeWidth={1.5} class="spin" />
					{:else if cloud.status === 'offline'}<CloudOff size={19} strokeWidth={1.5} />
					{:else if cloud.status === 'error'}<TriangleAlert
							size={19}
							strokeWidth={1.5}
							class="warn"
						/>
					{:else}<CloudCheck size={19} strokeWidth={1.5} />{/if}
				</IconButton>
			{/if}
			<IconButton
				label={ui.privacy ? 'Mostrar valores' : 'Ocultar valores'}
				onclick={togglePrivacy}
			>
				{#if ui.privacy}<EyeOff size={20} strokeWidth={1.5} />{:else}<Eye
						size={20}
						strokeWidth={1.5}
					/>{/if}
			</IconButton>
		</span>
	</div>

	{#if data.ready && data.accounts.length === 0}
		<section class="welcome">
			<p class="greet">{greeting}.</p>
			<h1>Tudo o que é seu, num só lugar.</h1>
			<p class="lead">
				Cadastre suas contas e cartões, importe os extratos do banco e veja seu patrimônio tomar
				forma. Os dados ficam só neste aparelho.
			</p>
			<div class="cta">
				<Button size="lg" onclick={() => (newAccountOpen = true)}>Cadastrar primeira conta</Button>
				<Button size="lg" variant="secondary" href={resolve('/importar')}
					><FileUp size={18} strokeWidth={1.6} />Importar extrato</Button
				>
			</div>
		</section>
	{:else if data.ready}
		<section class="hero">
			<p class="label">Patrimônio</p>
			<Amount cents={netWorth} size="xl" tone="auto" />
			<p class="delta">
				<Trend cents={monthDelta}>{monthDelta === 0 ? 'sem variação no mês' : 'neste mês'}</Trend>
			</p>
			<div class="chart"><LineChart points={series} /></div>
		</section>

		<section class="month">
			<a href={resolve('/relatorios')} class="cell">
				<FlowFigure kind="in" cents={month.incomeCents} label="Entradas no mês" />
			</a>
			<a href={resolve('/relatorios')} class="cell">
				<FlowFigure kind="out" cents={month.expenseCents} label="Saídas no mês" />
			</a>
		</section>

		{#each groups as group (group.label)}
			<section class="block">
				<header>
					<h2>{group.label}</h2>
					<a href={resolve('/contas')} class="link">Gerenciar</a>
				</header>
				<ul>
					{#each group.accounts as a (a.id)}
						{@const Icon = ACCOUNT_KIND_ICON[data.kindOf(a.id)]}
						<li>
							<a class="row account" href={resolve('/contas/[id]', { id: a.id })}>
								<span class="acct-ico tinted" style:--c={a.color}
									><Icon size={18} strokeWidth={1.6} /></span
								>
								<span class="main">
									<span>{a.name}</span>
									{#if a.institution}<small>{a.institution}</small>{/if}
								</span>
								<Amount cents={data.balances.get(a.id) ?? 0} size="sm" tone="debt" />
								<ChevronRight size={16} strokeWidth={1.5} class="chev" />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}

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
								category={u.rule.categoryId ? data.categoryById.get(u.rule.categoryId) : undefined}
							/>
							<span class="main">
								<span>{u.rule.description}</span>
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
				<a href={resolve('/extrato')} class="link">Ver extrato</a>
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
	{/if}
</div>

<AccountEditor bind:open={newAccountOpen} />

<style>
	.page {
		padding-inline: 20px;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 56px;
		margin-right: -8px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 330;
		font-size: 23px;
		font-variation-settings: 'opsz' 144;
		letter-spacing: -0.005em;
	}
	.brand :global(.gem) {
		color: var(--brass);
	}
	.top-actions {
		display: flex;
		align-items: center;
		color: var(--ink-2);
	}
	.top-actions :global(.spin) {
		animation: spin 900ms linear infinite;
	}
	.top-actions :global(.warn) {
		color: var(--loss);
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	/* Em telas largas a marca já está no trilho lateral. */
	@media (min-width: 900px) {
		.brand {
			visibility: hidden;
		}
	}
	.label {
		font-size: 13px;
		color: var(--ink-2);
	}
	.hero {
		padding: 28px 0 8px;
	}
	.hero .label {
		margin-bottom: 10px;
	}
	.delta {
		margin-top: 14px;
	}
	.chart {
		margin-top: 22px;
	}
	.month {
		display: grid;
		grid-template-columns: 1fr 1fr;
		margin: 28px 0 8px;
		border-block: 1px solid var(--rule);
	}
	.cell {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 16px 0;
	}
	.cell + .cell {
		padding-left: 20px;
		border-left: 1px solid var(--rule);
	}
	.block {
		margin-top: 36px;
	}
	.block header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 4px;
	}
	h2 {
		font-size: 22px;
		font-variation-settings: 'opsz' 48;
	}
	.link {
		font-size: 14px;
		color: var(--accent);
	}
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.main small {
		font-size: 13px;
		color: var(--ink-2);
	}
	.account :global(.chev) {
		color: var(--ink-3);
		margin-right: -4px;
	}
	.acct-ico {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
	}
	.muted {
		color: var(--ink-2);
		padding: 12px 0;
	}
	.welcome {
		padding: 48px 0 24px;
	}
	.greet {
		color: var(--ink-2);
	}
	.welcome h1 {
		margin-top: 8px;
		font-size: clamp(36px, 10vw, 52px);
		font-weight: 300;
		font-variation-settings: 'opsz' 144;
		letter-spacing: -0.03em;
		max-width: 12ch;
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
</style>

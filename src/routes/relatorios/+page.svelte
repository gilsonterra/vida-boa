<script lang="ts">
	import { formatMonth, formatMonthShort, monthKey, shiftMonth, today } from '#lib/domain/dates.ts';
	import {
		chartMonths,
		inMonth,
		monthlySeries,
		summarize,
		totalsByCategory
	} from '#lib/domain/reports.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import Amount from '#lib/ui/Amount.svelte';
	import CategoryBreakdown from '#lib/ui/charts/CategoryBreakdown.svelte';
	import MonthBars from '#lib/ui/charts/MonthBars.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FlowFigure from '#lib/ui/FlowFigure.svelte';
	import Trend from '#lib/ui/Trend.svelte';
	import MonthSwitcher from '#lib/ui/MonthSwitcher.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import TransactionRow from '#lib/ui/TransactionRow.svelte';

	const data = useAppData();
	const current = monthKey(today());
	let month = $state(current);

	const monthTx = $derived(inMonth(data.transactions, month));
	const summary = $derived(summarize(monthTx));
	const previous = $derived(summarize(inMonth(data.transactions, shiftMonth(month, -1))));
	const series = $derived(monthlySeries(data.transactions, chartMonths(data.transactions, month)));
	const expenses = $derived(totalsByCategory(monthTx, 'expense'));
	const incomes = $derived(totalsByCategory(monthTx, 'income'));
	const biggest = $derived(
		monthTx
			.filter((t) => t.kind === 'expense' && t.amountCents < 0)
			.sort((a, b) => a.amountCents - b.amountCents)
			.slice(0, 5)
	);

	const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
	const savingsRate = $derived(
		summary.incomeCents > 0 ? summary.netCents / summary.incomeCents : null
	);
	const incomeChange = $derived(
		previous.incomeCents > 0
			? (summary.incomeCents - previous.incomeCents) / previous.incomeCents
			: null
	);
	const expenseChange = $derived(
		previous.expenseCents > 0
			? (summary.expenseCents - previous.expenseCents) / previous.expenseCents
			: null
	);
</script>

<PageHeader title="Relatórios" />

<div class="page">
	<MonthSwitcher bind:value={month} />

	{#if data.ready && data.transactions.length === 0}
		<EmptyState
			title="Ainda sem dados"
			text="Os relatórios aparecem assim que houver lançamentos ou um extrato importado."
		/>
	{:else}
		<section class="summary">
			<div class="big">
				<span class="label">Resultado de {formatMonth(month).toLowerCase()}</span>
				<Amount cents={summary.netCents} size="lg" signed tone="auto" indicator />
				{#if savingsRate !== null}
					<p class="note">
						{savingsRate >= 0
							? `Você guardou ${pct.format(savingsRate)} do que entrou.`
							: `As saídas superaram as entradas em ${pct.format(-savingsRate)}.`}
					</p>
				{/if}
			</div>
			<div class="flows">
				<div>
					<FlowFigure kind="in" cents={summary.incomeCents} />
					{#if incomeChange !== null}
						<div class="change">
							<Trend ratio={incomeChange}>vs. {formatMonthShort(shiftMonth(month, -1))}</Trend>
						</div>
					{/if}
				</div>
				<div>
					<FlowFigure kind="out" cents={summary.expenseCents} />
					{#if expenseChange !== null}
						<div class="change">
							<!-- Gasto subir é ruim: seta para cima em vermelho. -->
							<Trend ratio={expenseChange} goodWhen="down"
								>vs. {formatMonthShort(shiftMonth(month, -1))}</Trend
							>
						</div>
					{/if}
				</div>
			</div>
		</section>

		<section class="block">
			<h2>Mês a mês</h2>
			<MonthBars {series} selected={month} onselect={(m) => (month = m)} />
		</section>

		<section class="block">
			<h2>Para onde foi o dinheiro</h2>
			{#if expenses.length}
				<CategoryBreakdown totals={expenses} />
			{:else}
				<p class="muted">Nenhuma despesa neste mês.</p>
			{/if}
		</section>

		{#if incomes.length}
			<section class="block">
				<h2>De onde veio</h2>
				<CategoryBreakdown totals={incomes} limit={5} />
			</section>
		{/if}

		{#if biggest.length}
			<section class="block">
				<h2>Maiores despesas</h2>
				{#each biggest as t (t.id)}<TransactionRow transaction={t} />{/each}
			</section>
		{/if}
	{/if}
</div>

<style>
	.page {
		padding-inline: 20px;
	}
	.summary {
		margin-top: 24px;
		padding: 24px 0;
		border-block: 1px solid var(--rule);
		display: grid;
		gap: 22px;
	}
	.label {
		display: block;
		font-size: 13px;
		color: var(--ink-2);
		margin-bottom: 6px;
	}
	.note {
		margin-top: 8px;
		font-size: 14px;
		color: var(--ink-2);
	}
	.flows {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin: 0;
	}
	.change {
		margin-top: 10px;
	}
	.block {
		margin-top: 40px;
	}
	h2 {
		font-size: 17px;
		margin-bottom: 14px;
	}
	.muted {
		color: var(--ink-2);
	}
	@media (min-width: 640px) {
		.summary {
			grid-template-columns: 1.2fr 1fr;
			align-items: end;
		}
	}
</style>

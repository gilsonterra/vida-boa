<script lang="ts">
	import { Search, X } from '@lucide/svelte';
	import { formatDayHeading, monthKey, today } from '#lib/domain/dates.ts';
	import { inMonth, summarize } from '#lib/domain/reports.ts';
	import { normalizeText } from '#lib/domain/text.ts';
	import type { Transaction } from '#lib/domain/types.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import Amount from '#lib/ui/Amount.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FlowFigure from '#lib/ui/FlowFigure.svelte';
	import MonthSwitcher from '#lib/ui/MonthSwitcher.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import TransactionRow from '#lib/ui/TransactionRow.svelte';

	const data = useAppData();

	let month = $state(monthKey(today()));
	let query = $state('');
	let accountId = $state('');
	let filter = $state<'all' | 'expense' | 'income' | 'transfer' | 'uncategorized'>('all');

	const filtered = $derived.by(() => {
		const q = normalizeText(query);
		// Com busca, procura em todos os meses; sem busca, mostra o mês escolhido.
		const base = q ? data.transactions : inMonth(data.transactions, month);
		return base.filter((t) => {
			if (accountId && t.accountId !== accountId) return false;
			if (filter === 'uncategorized' && (t.categoryId || t.kind === 'transfer')) return false;
			if (filter !== 'all' && filter !== 'uncategorized' && t.kind !== filter) return false;
			if (q) {
				const cat = t.categoryId ? (data.categoryById.get(t.categoryId)?.name ?? '') : '';
				const hay = normalizeText(`${t.description} ${t.notes} ${cat}`);
				if (!hay.includes(q)) return false;
			}
			return true;
		});
	});

	const days = $derived.by(() => {
		const map = new Map<string, Transaction[]>();
		for (const t of filtered) map.set(t.date, [...(map.get(t.date) ?? []), t]);
		return [...map.entries()].map(([date, items]) => ({
			date,
			items,
			net: items.reduce((s, t) => s + (t.kind === 'transfer' ? 0 : t.amountCents), 0)
		}));
	});

	const totals = $derived(summarize(filtered));
	const uncategorizedCount = $derived(
		inMonth(data.transactions, month).filter((t) => !t.categoryId && t.kind !== 'transfer').length
	);

	const filters = $derived([
		{ value: 'all', label: 'Tudo' },
		{ value: 'expense', label: 'Despesas' },
		{ value: 'income', label: 'Receitas' },
		{ value: 'transfer', label: 'Transferências' },
		{
			value: 'uncategorized',
			label: uncategorizedCount ? `Sem categoria (${uncategorizedCount})` : 'Sem categoria'
		}
	] as const);
</script>

<PageHeader title="Extrato" />

<div class="page">
	<div class="tools">
		<label class="search">
			<Search size={18} strokeWidth={1.6} />
			<span class="sr-only">Buscar lançamentos</span>
			<input type="search" placeholder="Buscar em todos os meses" bind:value={query} />
			{#if query}
				<button type="button" onclick={() => (query = '')} aria-label="Limpar busca"
					><X size={16} /></button
				>
			{/if}
		</label>

		{#if !query}<MonthSwitcher bind:value={month} />{/if}

		<div class="chips no-scrollbar" role="radiogroup" aria-label="Filtrar por tipo">
			<select class="chip select" bind:value={accountId} aria-label="Conta">
				<option value="">Todas as contas</option>
				{#each data.accounts as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
			</select>
			{#each filters as f (f.value)}
				<button
					type="button"
					role="radio"
					aria-checked={filter === f.value}
					class="chip"
					class:on={filter === f.value}
					onclick={() => (filter = f.value)}>{f.label}</button
				>
			{/each}
		</div>
	</div>

	{#if filtered.length}
		<div class="totals">
			<FlowFigure kind="in" cents={totals.incomeCents} size="sm" />
			<FlowFigure kind="out" cents={totals.expenseCents} size="sm" />
			<FlowFigure kind="net" cents={totals.netCents} size="sm" />
		</div>

		{#each days as day (day.date)}
			<section class="day">
				<header>
					<h2>{formatDayHeading(day.date)}</h2>
					{#if day.net !== 0}<Amount
							cents={day.net}
							size="sm"
							signed
							tone="auto"
							indicator
							class="day-net"
						/>{/if}
				</header>
				{#each day.items as t (t.id)}
					<TransactionRow transaction={t} showAccount={!accountId} />
				{/each}
			</section>
		{/each}
	{:else if data.ready}
		<EmptyState
			title={query ? 'Nada encontrado' : 'Nenhum lançamento'}
			text={query
				? 'Tente outra palavra. A busca olha descrição, observações e categoria.'
				: 'Não há lançamentos neste mês com os filtros escolhidos.'}
		/>
	{/if}
</div>

<style>
	.page {
		padding-inline: 20px;
	}
	.tools {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 46px;
		padding: 0 14px;
		border-radius: 14px;
		background: var(--sunken);
		color: var(--ink-3);
	}
	.search input {
		flex: 1;
		min-width: 0;
		background: none;
		border: 0;
		outline: none;
		color: var(--ink);
	}
	.search input::-webkit-search-cancel-button {
		display: none;
	}
	.chips {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin-inline: -20px;
		padding-inline: 20px;
	}
	.chip {
		flex-shrink: 0;
		height: 34px;
		padding: 0 14px;
		border-radius: 999px;
		font-size: 13.5px;
		color: var(--ink-2);
		box-shadow: inset 0 0 0 1px var(--rule-strong);
		background: transparent;
	}
	.chip.on {
		background: var(--ink);
		color: var(--paper);
		box-shadow: none;
	}
	.chip.select {
		appearance: none;
		padding-right: 14px;
		max-width: 180px;
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		margin-top: 22px;
		padding: 14px 0;
		border-block: 1px solid var(--rule);
	}
	.day {
		margin-top: 26px;
	}
	.day header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--rule-strong);
	}
	.day h2 {
		font-size: 17px;
		font-variation-settings: 'opsz' 24;
	}
	.day :global(.day-net) {
		font-size: 13px;
	}
</style>

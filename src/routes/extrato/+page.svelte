<script lang="ts">
	import { dragScroll } from '#lib/ui/drag-scroll.ts';
	import { CalendarCheck, Pencil, Search, X } from '@lucide/svelte';
	import {
		formatDayHeading,
		formatDayShortYear,
		monthKey,
		monthRange,
		today
	} from '#lib/domain/dates.ts';
	import { flows, sumEntries, transactionEntry, type Entry } from '#lib/domain/ledger.ts';
	import { normalizeText } from '#lib/domain/text.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { takeStatementAccount } from '#lib/stores/ui.svelte.ts';
	import AccountEditor from '#lib/ui/AccountEditor.svelte';
	import Amount from '#lib/ui/Amount.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import EntryRow from '#lib/ui/EntryRow.svelte';
	import FlowFigure from '#lib/ui/FlowFigure.svelte';
	import MonthSwitcher from '#lib/ui/MonthSwitcher.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Trend from '#lib/ui/Trend.svelte';

	/**
	 * Extrato do mês: lançamentos, parcelas de financiamento e recorrências previstas.
	 * Os totais e o saldo atual contam só o consolidado; o pendente aparece à parte e
	 * entra no saldo previsto do fim do mês.
	 */
	const data = useAppData();
	const now = today();
	const thisMonth = monthKey(now);

	type Filter =
		'all' | 'expense' | 'income' | 'transfer' | 'uncategorized' | 'pending' | 'recurring';
	let month = $state(thisMonth);
	let query = $state('');
	/** Filtro de conta: o Extrato de uma conta é a "tela da conta" (vem de `openStatement`). */
	let accountId = $state(takeStatementAccount() ?? '');
	let accountEditorOpen = $state(false);
	const account = $derived(accountId ? data.accountById.get(accountId) : undefined);
	/** Cartão mostra a fatura em aberto (positiva), não o saldo negativo. */
	const card = $derived(!!account && data.kindOf(account.id) === 'credit_card');
	const sign = $derived(card ? -1 : 1);
	let filter = $state<Filter>('all');

	const range = $derived(monthRange(month));
	const monthEntries = $derived(data.entries(range.start, range.end, true));

	function matches(e: Entry, f: Filter): boolean {
		// Parcelas não têm conta: somem quando o filtro de conta está ligado.
		if (accountId && e.accountId !== accountId) return false;
		const t = e.transaction;
		switch (f) {
			case 'all':
				return true;
			case 'pending':
				return e.consolidated !== true;
			case 'recurring':
				return e.source === 'recurring' || !!t?.recurringId;
			case 'transfer':
				return e.transfer;
			case 'uncategorized':
				return !!t && !t.categoryId && t.kind !== 'transfer';
			case 'expense':
				return !e.transfer && (t ? t.kind === 'expense' : e.amountCents < 0);
			case 'income':
				return !e.transfer && (t ? t.kind === 'income' : e.amountCents > 0);
		}
	}

	const filtered = $derived.by(() => {
		const q = normalizeText(query);
		if (!q) return monthEntries.filter((e) => matches(e, filter));
		// Com busca, procura nos lançamentos de todos os meses.
		return data.transactions
			.filter((t) => {
				const cat = t.categoryId ? (data.categoryById.get(t.categoryId)?.name ?? '') : '';
				return normalizeText(`${t.description} ${t.notes} ${cat}`).includes(q);
			})
			.map(transactionEntry)
			.filter((e) => matches(e, filter));
	});

	const days = $derived.by(() => {
		const map = new Map<string, Entry[]>();
		for (const e of filtered) map.set(e.date, [...(map.get(e.date) ?? []), e]);
		return [...map.entries()]
			.sort(([a], [b]) => b.localeCompare(a))
			.map(([date, items]) => ({
				date,
				items,
				net: sumEntries(items.filter((e) => !e.transfer))
			}));
	});

	/** Totais do que já está consolidado; o pendente vem separado. */
	const done = $derived(flows(filtered.filter((e) => e.consolidated === true)));
	const open = $derived(flows(filtered.filter((e) => e.consolidated !== true)));

	/** Saldo atual (da conta filtrada ou o patrimônio) e o previsto no fim do mês escolhido. */
	const current = $derived(accountId ? (data.balances.get(accountId) ?? 0) : data.netWorth);
	const showForecast = $derived(!query && month >= thisMonth);
	const pendingToEnd = $derived(
		showForecast
			? data.pending(range.end).filter((e) => !accountId || e.accountId === accountId)
			: []
	);
	const projected = $derived(current + sumEntries(pendingToEnd));
	const debt = $derived(accountId ? 0 : data.projectedDebtAt(range.end));

	const counts = $derived({
		uncategorized: monthEntries.filter((e) => matches(e, 'uncategorized')).length,
		pending: monthEntries.filter((e) => matches(e, 'pending')).length
	});
	const filters = $derived([
		{ value: 'all', label: 'Tudo' },
		{ value: 'pending', label: counts.pending ? `Pendentes (${counts.pending})` : 'Pendentes' },
		{ value: 'recurring', label: 'Recorrentes' },
		{ value: 'expense', label: 'Despesas' },
		{ value: 'income', label: 'Receitas' },
		{ value: 'transfer', label: 'Transferências' },
		{
			value: 'uncategorized',
			label: counts.uncategorized ? `Sem categoria (${counts.uncategorized})` : 'Sem categoria'
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

		{#if !query}
			<MonthSwitcher bind:value={month} max={null}>
				{#snippet beforeNext()}
					{#if month !== thisMonth}
						<button type="button" class="today" onclick={() => (month = thisMonth)}
							><CalendarCheck size={16} strokeWidth={1.8} />Hoje</button
						>
					{/if}
				{/snippet}
			</MonthSwitcher>
		{/if}

		<div class="chips no-scrollbar" use:dragScroll role="radiogroup" aria-label="Filtrar por tipo">
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

	{#if !query}
		<section class="balance">
			<div>
				<span class="label"
					>{account ? (card ? 'Fatura em aberto' : 'Saldo atual') : 'Patrimônio atual'}</span
				>
				<Amount cents={sign * current} size="md" tone={card ? 'neutral' : 'auto'} />
			</div>
			{#if showForecast}
				<div>
					<span class="label">Previsto em {formatDayShortYear(range.end)}</span>
					<Amount cents={sign * projected} size="md" tone={card ? 'neutral' : 'auto'} />
					{#if projected !== current && !card}<Trend cents={projected - current} />{/if}
				</div>
			{/if}
			{#if account}
				<p class="acct-line">
					<i style:background={account.color}></i>
					<span
						>{[data.typeById.get(account.typeId)?.name, account.institution]
							.filter(Boolean)
							.join(', ')}</span
					>
					<IconButton label="Editar conta" onclick={() => (accountEditorOpen = true)}
						><Pencil size={17} strokeWidth={1.6} /></IconButton
					>
				</p>
			{/if}
			{#if showForecast && debt > 0}
				<p class="debt">
					Falta pagar nos financiamentos <Amount cents={-debt} size="sm" tone="loss" />
				</p>
			{/if}
		</section>
	{/if}

	{#if days.length}
		<div class="totals">
			<FlowFigure kind="in" cents={done.incomeCents} size="sm" />
			<FlowFigure kind="out" cents={done.expenseCents} size="sm" />
			<FlowFigure kind="net" cents={done.incomeCents - done.expenseCents} size="sm" />
			{#if open.incomeCents || open.expenseCents}
				<p class="open">
					Pendente:
					{#if open.incomeCents}<Amount
							cents={open.incomeCents}
							size="sm"
							signed
							tone="gain"
						/>{/if}
					{#if open.expenseCents}<Amount
							cents={-open.expenseCents}
							size="sm"
							signed
							tone="loss"
						/>{/if}
				</p>
			{/if}
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
				{#each day.items as e (e.key)}<EntryRow entry={e} showAccount={!accountId} />{/each}
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

{#if account}<AccountEditor bind:open={accountEditorOpen} {account} />{/if}

<style>
	.page {
		padding-inline: 20px;
	}
	.tools {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.today {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 38px;
		padding: 0 14px;
		border-radius: 999px;
		font-size: 13.5px;
		font-weight: 600;
		background: var(--brass);
		color: var(--on-accent);
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
		padding: 2px 20px 4px;
	}
	.chip {
		flex-shrink: 0;
		height: 34px;
		padding: 0 14px;
		border-radius: 999px;
		font-size: 13.5px;
		font-weight: 500;
		color: var(--ink);
		box-shadow: var(--shadow-card);
		background: var(--surface);
	}
	.chip.on {
		background: var(--brass);
		color: var(--on-accent);
		font-weight: 600;
	}
	.chip.select {
		appearance: none;
		padding-right: 14px;
		max-width: 180px;
	}
	.balance {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-top: 18px;
		padding: 16px;
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow-card);
	}
	.balance > div {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}
	.label {
		font-size: 13px;
		color: var(--ink-2);
	}
	.acct-line {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 8px;
		padding-top: 6px;
		border-top: 1px solid var(--rule);
		font-size: 13px;
		color: var(--ink-2);
	}
	.acct-line span {
		flex: 1;
	}
	.acct-line i {
		width: 8px;
		height: 8px;
		border-radius: 99px;
	}
	.debt {
		grid-column: 1 / -1;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		padding-top: 10px;
		border-top: 1px solid var(--rule);
		font-size: 13px;
		color: var(--ink-2);
	}
	.open {
		grid-column: 1 / -1;
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--rule);
		font-size: 13px;
		color: var(--ink-2);
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		margin-top: 18px;
		padding: 16px;
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow-card);
	}
	.day {
		margin-top: 26px;
	}
	.day header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding-bottom: 10px;
	}
	.day h2 {
		font-size: 17px;
	}
	.day :global(.day-net) {
		font-size: 13px;
	}
</style>

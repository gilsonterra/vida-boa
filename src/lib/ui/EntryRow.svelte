<script lang="ts">
	import { resolve } from '$app/paths';
	import { Landmark, Repeat } from '@lucide/svelte';
	import { formatDayShort } from '../domain/dates';
	import { canConsolidate, type Entry } from '../domain/ledger';
	import {
		launchRecurring,
		setInstallmentConsolidated,
		setTransactionConsolidated
	} from '../stores/consolidate';
	import { useAppData } from '../stores/data.svelte';
	import { openEditor } from '../stores/ui.svelte';
	import Amount from './Amount.svelte';
	import CategoryMark from './CategoryMark.svelte';
	import ConsolidateToggle from './ConsolidateToggle.svelte';

	/**
	 * Uma linha do extrato: lançamento, parcela de financiamento ou recorrência prevista.
	 * O que não está consolidado fica apagado; a marca ✓/○ troca com um toque.
	 */
	interface Props {
		entry: Entry;
		/** Mostra a conta sob o valor (útil no extrato geral). */
		showAccount?: boolean;
		/** Mostra a data na segunda linha (listas que não agrupam por dia). */
		showDate?: boolean;
	}

	let { entry: e, showAccount = true, showDate = false }: Props = $props();
	const data = useAppData();

	const t = $derived(e.transaction);
	const category = $derived(e.categoryId ? data.categoryById.get(e.categoryId) : undefined);
	const account = $derived(e.accountId ? data.accountById.get(e.accountId) : undefined);
	/** Transferência não tem marca: é sempre consolidada. */
	const markable = $derived(!t || canConsolidate(t));
	const dim = $derived(e.consolidated !== true);

	const detail = $derived.by(() => {
		if (e.source === 'installment') return 'Financiamento';
		if (e.source === 'recurring') return 'Recorrência prevista';
		if (t!.kind === 'transfer') {
			const partner = data.partnerOf(t!);
			const other = partner ? data.accountById.get(partner.accountId)?.name : null;
			if (!other) return 'Transferência sem par';
			return t!.amountCents < 0 ? `Para ${other}` : `De ${other}`;
		}
		if (category) return category.name;
		return t!.amountCents > 0 && t!.kind === 'expense' ? 'Estorno sem categoria' : 'Sem categoria';
	});
	const missing = $derived(!!t && !category && t.kind !== 'transfer');

	function toggle() {
		if (t) void setTransactionConsolidated(t, !e.consolidated);
		else if (e.loan && e.installment)
			void setInstallmentConsolidated(e.loan, e.installment.n, !e.consolidated);
		else if (e.recurringRule) void launchRecurring(e.recurringRule, e.date);
	}
</script>

{#snippet body()}
	{#if e.source === 'installment'}
		<span class="mark tinted" style:--c="var(--ink-2)" aria-hidden="true"
			><Landmark size={18} strokeWidth={1.6} /></span
		>
	{:else if e.source === 'recurring' && !category}
		<span class="mark tinted" style:--c="var(--ink-2)" aria-hidden="true"
			><Repeat size={18} strokeWidth={1.6} /></span
		>
	{:else}
		<CategoryMark {category} transfer={e.transfer} />
	{/if}
	<span class="main">
		<span class="desc">{e.description}</span>
		<span class="sub" class:missing>
			{#if showDate}{formatDayShort(e.date)} ·
			{/if}{#if e.consolidated === false}<b class="tag">Pendente</b>{/if}{detail}
		</span>
	</span>
	<span class="side">
		<Amount
			cents={e.amountCents}
			size="sm"
			signed={!e.transfer}
			tone={e.transfer ? 'neutral' : 'auto'}
		/>
		{#if showAccount && account}
			<span class="acct"><i style:background={account.color}></i>{account.name}</span>
		{/if}
	</span>
{/snippet}

<div class="row entry" class:dim class:markable>
	{#if t}
		<button type="button" class="open" onclick={() => openEditor({ transaction: t })}
			>{@render body()}</button
		>
	{:else if e.loan}
		<a class="open" href={resolve('/financiamentos/[id]', { id: e.loan.id })}>{@render body()}</a>
	{:else if e.recurringRule}
		<button
			type="button"
			class="open"
			onclick={() => openEditor({ occurrence: { rule: e.recurringRule!, date: e.date } })}
			>{@render body()}</button
		>
	{/if}
	{#if markable}<ConsolidateToggle on={e.consolidated === true} onclick={toggle} />{/if}
</div>

<style>
	.entry {
		gap: 10px;
	}
	/* Com a marca no canto, a linha encosta menos na borda. */
	.entry.markable {
		padding-right: 8px;
	}
	.open {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 14px;
		text-align: left;
		color: inherit;
		transition: transform 120ms;
	}
	.open:active {
		transform: scale(0.985);
	}
	/* Pendente ou só previsto: ainda não conta, fica apagado (a marca não). */
	.entry.dim .open {
		opacity: 0.55;
	}
	.mark {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 999px;
	}
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.desc {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	.sub {
		font-size: 13px;
		color: var(--ink-2);
	}
	.sub.missing {
		color: var(--brass);
	}
	.tag {
		margin-right: 6px;
		font-weight: 600;
		color: var(--ink-3);
	}
	.side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 3px;
	}
	.acct {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: var(--ink-3);
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.acct i {
		width: 6px;
		height: 6px;
		border-radius: 99px;
		flex-shrink: 0;
	}
</style>

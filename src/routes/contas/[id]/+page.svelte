<script lang="ts">
	import { resolve } from '$app/paths';
	import { Pencil } from '@lucide/svelte';
	import { formatDayHeading, monthKey, today } from '#lib/domain/dates.ts';
	import { inMonth, summarize } from '#lib/domain/reports.ts';
	import { ACCOUNT_KIND_LABEL } from '#lib/domain/seed.ts';
	import type { Transaction } from '#lib/domain/types.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { openEditor } from '#lib/stores/ui.svelte.ts';
	import AccountEditor from '#lib/ui/AccountEditor.svelte';
	import Amount from '#lib/ui/Amount.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FlowFigure from '#lib/ui/FlowFigure.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import MonthSwitcher from '#lib/ui/MonthSwitcher.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import TransactionRow from '#lib/ui/TransactionRow.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const data = useAppData();

	let month = $state(monthKey(today()));
	let editorOpen = $state(false);

	const account = $derived(data.accountById.get(params.id));
	const kind = $derived(account ? data.kindOf(account.id) : 'other');
	const balance = $derived(account ? (data.balances.get(account.id) ?? 0) : 0);
	const txs = $derived(
		inMonth(
			data.transactions.filter((t) => t.accountId === params.id),
			month
		)
	);
	const summary = $derived(summarize(txs));

	const days = $derived.by(() => {
		const map = new Map<string, Transaction[]>();
		for (const t of txs) map.set(t.date, [...(map.get(t.date) ?? []), t]);
		return [...map.entries()];
	});
</script>

{#if account}
	<PageHeader
		title={account.name}
		back={{ href: resolve('/'), label: 'Início' }}
		subtitle={[
			data.typeById.get(account.typeId)?.name ?? ACCOUNT_KIND_LABEL[kind],
			account.institution
		]
			.filter(Boolean)
			.join(', ')}
	>
		{#snippet actions()}
			<IconButton label="Editar conta" onclick={() => (editorOpen = true)}
				><Pencil size={19} strokeWidth={1.6} /></IconButton
			>
		{/snippet}
	</PageHeader>

	<div class="page">
		<section class="balance" style:--c={account.color}>
			<span class="label">{kind === 'credit_card' ? 'Fatura em aberto' : 'Saldo atual'}</span>
			<Amount
				cents={kind === 'credit_card' ? -balance : balance}
				size="lg"
				tone={kind === 'credit_card' ? 'neutral' : 'debt'}
			/>
		</section>

		<div class="actions">
			<Button
				variant="secondary"
				size="sm"
				onclick={() => openEditor({ defaults: { accountId: account.id } })}>Lançar</Button
			>
			<Button variant="secondary" size="sm" href={resolve('/importar')}>Importar extrato</Button>
		</div>

		<MonthSwitcher bind:value={month} />

		{#if txs.length}
			<div class="totals">
				<FlowFigure kind="in" cents={summary.incomeCents} size="sm" />
				<FlowFigure kind="out" cents={summary.expenseCents} size="sm" />
			</div>
			{#each days as [date, items] (date)}
				<section class="day">
					<h2>{formatDayHeading(date)}</h2>
					{#each items as t (t.id)}<TransactionRow transaction={t} showAccount={false} />{/each}
				</section>
			{/each}
		{:else}
			<EmptyState
				title="Sem lançamentos"
				text="Nenhuma movimentação nesta conta no mês escolhido."
			/>
		{/if}
	</div>

	<AccountEditor bind:open={editorOpen} {account} />
{:else if data.ready}
	<PageHeader title="Conta não encontrada" back={{ href: resolve('/contas'), label: 'Contas' }} />
{/if}

<style>
	.page {
		padding-inline: 20px;
	}
	.balance {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-left: 14px;
		border-left: 3px solid var(--c);
	}
	.label {
		font-size: 13px;
		color: var(--ink-2);
	}
	.actions {
		display: flex;
		gap: 8px;
		margin: 22px 0 28px;
	}
	.totals {
		display: grid;
		grid-template-columns: 1fr 1fr;
		margin-top: 18px;
		padding: 12px 0;
		border-block: 1px solid var(--rule);
	}
	.day {
		margin-top: 24px;
	}
	.day h2 {
		font-size: 17px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--rule-strong);
	}
</style>

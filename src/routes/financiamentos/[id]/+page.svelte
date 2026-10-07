<script lang="ts">
	import { resolve } from '$app/paths';
	import { Pencil, Trash2 } from '@lucide/svelte';
	import { store } from '#lib/data/index.ts';
	import { formatDayShort, today } from '#lib/domain/dates.ts';
	import {
		buildSchedule,
		LOAN_KIND_LABEL,
		monthlyRate,
		outstandingAt,
		paidInstallments,
		SYSTEM_LABEL
	} from '#lib/domain/loans.ts';
	import { parseAmountToCents } from '#lib/domain/money.ts';
	import type { ID, PrepaymentEffect } from '#lib/domain/types.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { confirmAction, toast } from '#lib/stores/ui.svelte.ts';
	import Amount from '#lib/ui/Amount.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import LoanEditor from '#lib/ui/LoanEditor.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const data = useAppData();
	const now = today();

	let editorOpen = $state(false);
	let prepayOpen = $state(false);
	let prepayAmount = $state('');
	let prepayDate = $state(now);
	let prepayEffect = $state<PrepaymentEffect>('term');
	let prepayAccount = $state<ID>('');
	let prepayError = $state('');

	const loan = $derived(data.loans.find((l) => l.id === params.id));
	const schedule = $derived(loan ? data.schedules.get(loan.id) : undefined);
	const liveTxIds = $derived(new Set(data.transactions.map((t) => t.id)));
	const paid = $derived(
		loan && schedule ? paidInstallments(loan, schedule, liveTxIds) : new Set<number>()
	);
	const prepayments = $derived(
		data.prepayments
			.filter((p) => p.loanId === params.id)
			.sort((a, b) => b.date.localeCompare(a.date))
	);
	/** Juros que deixam de ser pagos por causa das amortizações extras. */
	const saved = $derived(
		loan && schedule ? buildSchedule(loan, []).totalInterestCents - schedule.totalInterestCents : 0
	);
	const balance = $derived(schedule ? outstandingAt(schedule, now) : 0);
	const next = $derived(schedule?.installments.find((i) => !paid.has(i.n)));
	const last = $derived(schedule?.installments.at(-1));
	const rateLabel = $derived.by(() => {
		if (!loan || loan.mode === 'simple') return null;
		const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
		const other =
			loan.ratePeriod === 'year'
				? `${pct.format(monthlyRate(loan.ratePercent, 'year') * 100)}% a.m.`
				: `${pct.format((Math.pow(1 + loan.ratePercent / 100, 12) - 1) * 100)}% a.a.`;
		return `${pct.format(loan.ratePercent)}% ${loan.ratePeriod === 'year' ? 'a.a.' : 'a.m.'} (${other})`;
	});

	function openPrepay() {
		prepayAmount = '';
		prepayDate = now;
		prepayEffect = 'term';
		prepayAccount = loan?.accountId ?? data.activeAccounts[0]?.id ?? '';
		prepayError = '';
		prepayOpen = true;
	}

	async function savePrepay(e: SubmitEvent) {
		e.preventDefault();
		if (!loan) return;
		const cents = parseAmountToCents(prepayAmount);
		if (!cents) return (prepayError = 'Informe um valor maior que zero.');
		if (cents > balance) return (prepayError = 'O valor passa do saldo devedor.');
		if (!prepayAccount) return (prepayError = 'Escolha a conta.');
		await store.loanPrepayments.create({
			loanId: loan.id,
			date: prepayDate,
			amountCents: Math.abs(cents),
			effect: prepayEffect,
			accountId: prepayAccount
		});
		toast('Amortização registrada');
		prepayOpen = false;
	}

	async function removePrepay(id: ID) {
		const ok = await confirmAction({
			title: 'Excluir amortização?',
			message: 'O lançamento dela sai do extrato e a tabela volta a ser calculada sem ela.',
			confirmLabel: 'Excluir',
			destructive: true
		});
		if (!ok) return;
		await store.loanPrepayments.remove(id);
		toast('Amortização excluída');
	}
</script>

<PageHeader
	title={loan?.name ?? 'Financiamento'}
	back={{ href: resolve('/financiamentos'), label: 'Financiamentos' }}
	subtitle={loan
		? `${LOAN_KIND_LABEL[loan.kind]} · ${loan.mode === 'simple' ? 'parcela fixa' : SYSTEM_LABEL[loan.system]}${rateLabel ? ` · ${rateLabel}` : ''}`
		: undefined}
>
	{#snippet actions()}
		{#if loan}
			<IconButton label="Editar" onclick={() => (editorOpen = true)}
				><Pencil size={20} strokeWidth={1.6} /></IconButton
			>
		{/if}
	{/snippet}
</PageHeader>

<div class="page">
	{#if loan && schedule}
		<section class="hero">
			<span class="label">Saldo devedor</span>
			<Amount cents={-balance} size="xl" tone="loss" />
			<span class="bar" aria-hidden="true"
				><span style:width="{(paid.size / Math.max(schedule.installments.length, 1)) * 100}%"
				></span></span
			>
			<small>{paid.size} de {schedule.installments.length} parcelas pagas</small>
		</section>

		<dl class="facts">
			<div>
				<dt>Próxima parcela</dt>
				<dd>
					{#if next}<Amount cents={next.paymentCents} size="md" /><small
							>{formatDayShort(next.dueDate)}</small
						>{:else}Quitado{/if}
				</dd>
			</div>
			<div>
				<dt>Restam</dt>
				<dd>
					{schedule.installments.length - paid.size} parcelas{#if last}<small
							>até {formatDayShort(last.dueDate)}</small
						>{/if}
				</dd>
			</div>
			<div>
				<dt>Valor financiado</dt>
				<dd><Amount cents={schedule.principalCents} size="md" /></dd>
			</div>
			<div>
				<dt>Juros no contrato</dt>
				<dd><Amount cents={schedule.totalInterestCents} size="md" /></dd>
			</div>
			<div>
				<dt>Total a pagar</dt>
				<dd><Amount cents={schedule.totalPaidCents} size="md" /></dd>
			</div>
			{#if saved > 0}
				<div>
					<dt>Juros economizados</dt>
					<dd><Amount cents={saved} size="md" tone="gain" /></dd>
				</div>
			{/if}
		</dl>

		<section class="block">
			<header>
				<h2>Amortizações extras</h2>
				{#if balance > 0}<Button size="sm" variant="secondary" onclick={openPrepay}
						>Amortizar</Button
					>{/if}
			</header>
			{#if prepayments.length}
				<ul class="prepays">
					{#each prepayments as p (p.id)}
						<li>
							<span class="main">
								<span>{formatDayShort(p.date)}</span>
								<small>{p.effect === 'term' ? 'Reduziu o prazo' : 'Reduziu a parcela'}</small>
							</span>
							<Amount cents={-p.amountCents} size="sm" tone="loss" />
							<IconButton label="Excluir amortização" onclick={() => removePrepay(p.id)}
								><Trash2 size={18} strokeWidth={1.6} /></IconButton
							>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="hint">
					Pagou um valor a mais? Registre aqui e veja o prazo ou a parcela diminuir.
				</p>
			{/if}
		</section>

		<section class="block">
			<header><h2>Tabela de amortização</h2></header>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>#</th>
							<th>Vencimento</th>
							<th>Parcela</th>
							<th>Juros</th>
							<th>Amortização</th>
							<th>Saldo</th>
						</tr>
					</thead>
					<tbody>
						{#each schedule.installments as i (i.n)}
							<tr class:paid={paid.has(i.n)} class:next={next?.n === i.n}>
								<td>{i.n}</td>
								<td>{formatDayShort(i.dueDate)}</td>
								<td><Amount cents={i.paymentCents} size="sm" /></td>
								<td><Amount cents={i.interestCents} size="sm" /></td>
								<td><Amount cents={i.amortizationCents} size="sm" /></td>
								<td><Amount cents={i.balanceCents} size="sm" /></td>
							</tr>
							{#each schedule.prepayments.filter((p) => p.afterInstallment === i.n) as p (p.id)}
								<tr class="extra">
									<td></td>
									<td>{formatDayShort(p.date)}</td>
									<td colspan="2">Amortização extra</td>
									<td><Amount cents={p.appliedCents} size="sm" /></td>
									<td></td>
								</tr>
							{/each}
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{:else if data.ready}
		<EmptyState title="Financiamento não encontrado" text="Ele pode ter sido excluído.">
			<Button href={resolve('/financiamentos')}>Ver financiamentos</Button>
		</EmptyState>
	{/if}
</div>

{#if loan}<LoanEditor bind:open={editorOpen} {loan} />{/if}

<Sheet bind:open={prepayOpen} title="Amortização extra">
	<form id="prepay-form" onsubmit={savePrepay} novalidate>
		<div class="two">
			<label>
				<span class="field-label">Valor</span>
				<input
					class="input figures"
					inputmode="decimal"
					bind:value={prepayAmount}
					placeholder="0,00"
				/>
			</label>
			<label>
				<span class="field-label">Data</span>
				<input class="input" type="date" bind:value={prepayDate} />
			</label>
		</div>
		<Segmented
			label="O que reduzir"
			bind:value={prepayEffect}
			options={[
				{ value: 'term', label: 'Prazo' },
				{ value: 'installment', label: 'Parcela' }
			]}
		/>
		<p class="hint">
			{prepayEffect === 'term'
				? 'A parcela continua igual e o financiamento acaba antes: é o que mais economiza juros.'
				: 'O prazo continua o mesmo e as próximas parcelas ficam menores.'}
		</p>
		<label>
			<span class="field-label">Conta</span>
			<select class="input" bind:value={prepayAccount}>
				{#each data.activeAccounts as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
			</select>
		</label>
		{#if prepayError}<p class="err">{prepayError}</p>{/if}
	</form>
	{#snippet footer()}
		<Button type="submit" form="prepay-form" size="lg" block>Registrar</Button>
	{/snippet}
</Sheet>

<style>
	.page {
		padding-inline: 20px;
		padding-bottom: 32px;
	}
	.hero {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 0 16px;
	}
	.label,
	small,
	dt,
	.hint {
		font-size: 13px;
		color: var(--ink-2);
	}
	.bar {
		display: block;
		height: 6px;
		margin-top: 8px;
		border-radius: 999px;
		background: var(--rule);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 14px 12px;
		margin: 0 0 24px;
		padding: 14px 0;
		border-block: 1px solid var(--rule);
	}
	dd {
		margin: 2px 0 0;
		display: flex;
		flex-direction: column;
	}
	.block {
		margin-bottom: 24px;
	}
	.block header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
	}
	h2 {
		font-size: 17px;
		margin: 0;
	}
	.prepays {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.prepays li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-bottom: 1px solid var(--rule);
	}
	.main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.table-wrap {
		overflow-x: auto;
		margin-inline: -20px;
		padding-inline: 20px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		white-space: nowrap;
	}
	th,
	td {
		padding: 7px 8px;
		text-align: right;
		border-bottom: 1px solid var(--rule);
	}
	th:nth-child(-n + 2),
	td:nth-child(-n + 2) {
		text-align: left;
	}
	th {
		font-weight: 600;
		color: var(--ink-2);
		position: sticky;
		top: 0;
		background: var(--paper);
	}
	tr.paid td {
		color: var(--ink-2);
		opacity: 0.7;
	}
	tr.next td {
		font-weight: 600;
		background: color-mix(in oklab, var(--accent) 10%, transparent);
	}
	tr.extra td {
		color: var(--accent);
		font-style: italic;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.err {
		color: var(--danger);
		font-size: 14px;
	}
</style>

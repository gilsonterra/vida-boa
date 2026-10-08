<script lang="ts">
	import { resolve } from '$app/paths';
	import { Pencil, Trash2 } from '@lucide/svelte';
	import { store } from '#lib/data/index.ts';
	import { formatDayShort, formatDayShortYear, today } from '#lib/domain/dates.ts';
	import {
		buildSchedule,
		LOAN_KIND_LABEL,
		monthlyRate,
		outstandingAt,
		SYSTEM_LABEL
	} from '#lib/domain/loans.ts';
	import { parseAmountToCents } from '#lib/domain/money.ts';
	import type { ID, PrepaymentEffect } from '#lib/domain/types.ts';
	import { setInstallmentConsolidated } from '#lib/stores/consolidate.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { confirmAction, toast } from '#lib/stores/ui.svelte.ts';
	import Amount from '#lib/ui/Amount.svelte';
	import Button from '#lib/ui/Button.svelte';
	import ConsolidateToggle from '#lib/ui/ConsolidateToggle.svelte';
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
	let prepayError = $state('');

	const loan = $derived(data.loans.find((l) => l.id === params.id));
	const schedule = $derived(loan ? data.schedules.get(loan.id) : undefined);
	/** Parcelas pagas = consolidadas (ou pagas antes do cadastro). */
	const paid = $derived((loan && data.paid.get(loan.id)) || new Set<number>());
	const prepayments = $derived(
		data.prepayments
			.filter((p) => p.loanId === params.id)
			.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
	);
	/** Juros que deixam de ser pagos por causa das amortizações extras (ajustes de saldo à parte). */
	const saved = $derived(
		loan && schedule
			? buildSchedule(
					loan,
					prepayments.filter((p) => p.effect === 'balance')
				).totalInterestCents - schedule.totalInterestCents
			: 0
	);
	const isBalance = $derived(prepayEffect === 'balance');
	/** Parcelas pagas (inclusive as de antes do app) mais as amortizações extras até hoje. */
	const paidCents = $derived(
		schedule
			? schedule.installments.reduce((t, i) => t + (paid.has(i.n) ? i.paymentCents : 0), 0) +
					schedule.prepayments.reduce(
						(t, p) => t + (p.effect !== 'balance' && p.date <= now ? p.appliedCents : 0),
						0
					)
			: 0
	);
	const balance = $derived(schedule ? outstandingAt(schedule, now, paid) : 0);
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

	function openPrepay(effect: PrepaymentEffect = 'term') {
		prepayAmount = '';
		prepayDate = now;
		prepayEffect = effect;
		prepayError = '';
		prepayOpen = true;
	}

	async function savePrepay(e: SubmitEvent) {
		e.preventDefault();
		if (!loan) return;
		const cents = parseAmountToCents(prepayAmount);
		if (!cents) return (prepayError = 'Informe um valor maior que zero.');
		if (!isBalance && cents > balance) return (prepayError = 'O valor passa do saldo devedor.');
		await store.loanPrepayments.create({
			loanId: loan.id,
			date: prepayDate,
			amountCents: Math.abs(cents),
			effect: prepayEffect
		});
		toast(isBalance ? 'Saldo atualizado' : 'Amortização registrada');
		prepayOpen = false;
	}

	async function removePrepay(id: ID, effect: PrepaymentEffect) {
		const ok = await confirmAction({
			title: effect === 'balance' ? 'Excluir saldo informado?' : 'Excluir amortização?',
			message:
				effect === 'balance'
					? 'A tabela volta a usar o saldo calculado pelo app.'
					: 'A tabela volta a ser calculada sem ela.',
			confirmLabel: 'Excluir',
			destructive: true
		});
		if (!ok) return;
		await store.loanPrepayments.remove(id);
		toast('Excluído');
	}
</script>

<PageHeader
	title={loan?.name ?? 'Financiamento'}
	back={{ href: resolve('/contas'), label: 'Contas' }}
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
				<dt>Valor pago</dt>
				<dd><Amount cents={paidCents} size="md" /></dd>
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
				{#if balance > 0}<span class="btns"
						><Button size="sm" variant="secondary" onclick={() => openPrepay('balance')}
							>Informar saldo</Button
						><Button size="sm" variant="secondary" onclick={() => openPrepay()}>Amortizar</Button
						></span
					>{/if}
			</header>
			{#if prepayments.length}
				<ul class="prepays">
					{#each prepayments as p (p.id)}
						<li>
							<span class="main">
								<span>{formatDayShortYear(p.date)}</span>
								<small
									>{p.effect === 'balance'
										? 'Saldo informado pelo banco'
										: p.effect === 'term'
											? 'Reduziu o prazo'
											: 'Reduziu a parcela'}</small
								>
							</span>
							{#if p.effect === 'balance'}<Amount cents={p.amountCents} size="sm" />{:else}<Amount
									cents={-p.amountCents}
									size="sm"
									tone="loss"
								/>{/if}
							<IconButton label="Excluir" onclick={() => removePrepay(p.id, p.effect)}
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
							<th><span class="sr-only">Consolidada</span></th>
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
								<td class="mark">
									{#if i.n > loan.paidBefore}
										<ConsolidateToggle
											on={paid.has(i.n)}
											size={20}
											onclick={() => setInstallmentConsolidated(loan, i.n, !paid.has(i.n))}
										/>
									{/if}
								</td>
							</tr>
							{#each schedule.prepayments.filter((p) => p.afterInstallment === i.n) as p (p.id)}
								<tr class="extra">
									<td></td>
									<td>{formatDayShort(p.date)}</td>
									<td colspan="2">
										{p.effect === 'balance' ? 'Ajuste pelo saldo do banco' : 'Amortização extra'}
									</td>
									<td><Amount cents={p.appliedCents} size="sm" /></td>
									<td></td>
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
			<Button href={resolve('/contas')}>Ver financiamentos</Button>
		</EmptyState>
	{/if}
</div>

{#if loan}<LoanEditor bind:open={editorOpen} {loan} />{/if}

<Sheet
	bind:open={prepayOpen}
	title={isBalance ? 'Saldo informado pelo banco' : 'Amortização extra'}
>
	<form id="prepay-form" onsubmit={savePrepay} novalidate>
		<div class="two">
			<label>
				<span class="field-label">{isBalance ? 'Saldo devedor' : 'Valor'}</span>
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
		{#if isBalance}
			<p class="hint">
				Use o saldo do extrato ou do app do banco (ele inclui correções como a TR, que o app não
				calcula). Use uma data depois da última parcela paga: a parcela continua a mesma e o prazo é
				recalculado a partir desse saldo.
			</p>
		{:else}
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
		{/if}
		{#if prepayError}<p class="err">{prepayError}</p>{/if}
	</form>
	{#snippet footer()}
		<Button type="submit" form="prepay-form" size="lg" block
			>{isBalance ? 'Salvar' : 'Registrar'}</Button
		>
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
	.btns {
		display: flex;
		gap: 8px;
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
	/* Pendente fica apagada (a marca não), como no extrato. */
	tr:not(.paid):not(.extra) td:not(.mark) {
		opacity: 0.55;
	}
	td.mark {
		padding-block: 0;
		width: 44px;
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

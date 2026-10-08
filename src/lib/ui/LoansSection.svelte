<script lang="ts">
	/** Seção de financiamentos da tela Contas: totais e um cartão por contrato. */
	import { resolve } from '$app/paths';
	import { Car, HandCoins, House, Plus, Wallet } from '@lucide/svelte';
	import { formatDayShort, today } from '../domain/dates';
	import { LOAN_KIND_LABEL, outstandingAt } from '../domain/loans';
	import type { Loan } from '../domain/types';
	import { useAppData } from '../stores/data.svelte';
	import Amount from './Amount.svelte';
	import Button from './Button.svelte';
	import EmptyState from './EmptyState.svelte';
	import IconButton from './IconButton.svelte';
	import LoanEditor from './LoanEditor.svelte';

	const data = useAppData();
	const now = today();
	let editorOpen = $state(false);

	const ICON = { home: House, vehicle: Car, personal: HandCoins, other: Wallet } as const;

	const rows = $derived(
		data.loans
			.map((loan) => {
				const schedule = data.schedules.get(loan.id)!;
				const paid = data.paid.get(loan.id)!;
				const next = schedule.installments.find((i) => !paid.has(i.n));
				return {
					loan,
					total: schedule.installments.length,
					paid: paid.size,
					balance: outstandingAt(schedule, now, paid),
					next
				};
			})
			.sort(
				(a, b) =>
					Number(!a.next) - Number(!b.next) || a.loan.name.localeCompare(b.loan.name, 'pt-BR')
			)
	);
	const totalDebt = $derived(rows.reduce((s, r) => s + r.balance, 0));
	const monthly = $derived(
		rows.reduce(
			(s, r) =>
				s + (r.next && r.next.dueDate.slice(0, 7) === now.slice(0, 7) ? r.next.paymentCents : 0),
			0
		)
	);

	const href = (l: Loan) => resolve('/financiamentos/[id]', { id: l.id });
</script>

<section class="section">
	<header>
		<div>
			<h2>Financiamentos</h2>
			<p>Imóvel, veículo, empréstimos: marque as parcelas pagas e acompanhe o saldo devedor.</p>
		</div>
		<IconButton tone="hi" label="Novo financiamento" onclick={() => (editorOpen = true)}
			><Plus size={22} strokeWidth={1.6} /></IconButton
		>
	</header>

	{#if rows.length}
		<div class="totals">
			<div>
				<span>Saldo devedor total</span>
				<Amount cents={-totalDebt} size="lg" tone="loss" />
			</div>
			<div>
				<span>Parcelas deste mês</span>
				<Amount cents={-monthly} size="md" tone="loss" />
			</div>
		</div>
		<ul>
			{#each rows as r (r.loan.id)}
				{@const Icon = ICON[r.loan.kind]}
				<li>
					<a class="card" href={href(r.loan)} class:done={!r.next}>
						<span class="ico"><Icon size={20} strokeWidth={1.6} /></span>
						<span class="main">
							<span class="name">{r.loan.name}</span>
							<small>
								{LOAN_KIND_LABEL[r.loan.kind]} · {r.paid}/{r.total} pagas{r.next
									? ` · próxima em ${formatDayShort(r.next.dueDate)}`
									: ' · quitado'}
							</small>
							<span class="bar" aria-hidden="true"
								><span style:width="{(r.total ? r.paid / r.total : 1) * 100}%"></span></span
							>
						</span>
						<span class="figs">
							<Amount cents={-r.balance} size="sm" tone="loss" />
							{#if r.next}<small>parcela <Amount cents={r.next.paymentCents} size="sm" /></small
								>{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else if data.ready}
		<EmptyState
			title="Nenhum financiamento"
			text="Cadastre um contrato (valor, taxa e prazo) ou só o valor e a quantidade de parcelas."
		>
			<Button onclick={() => (editorOpen = true)}>Novo financiamento</Button>
		</EmptyState>
	{/if}
</section>

<LoanEditor bind:open={editorOpen} />

<style>
	.section {
		margin-top: 36px;
	}
	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}
	h2 {
		font-size: 20px;
	}
	header p {
		margin-top: 4px;
		font-size: 13px;
		color: var(--ink-2);
	}
	.totals {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		padding: 14px 0;
		margin-bottom: 8px;
		border-block: 1px solid var(--rule);
	}
	.totals div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.totals span {
		font-size: 13px;
		color: var(--ink-2);
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 0;
		list-style: none;
	}
	.card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
		border-radius: 16px;
		background: var(--surface);
		box-shadow: var(--shadow-card);
		color: inherit;
		text-decoration: none;
	}
	.card.done {
		opacity: 0.6;
	}
	.ico {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: 12px;
		background: color-mix(in oklab, var(--accent) 14%, transparent);
		color: var(--accent);
	}
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.name {
		font-weight: 600;
	}
	small {
		font-size: 13px;
		color: var(--ink-2);
	}
	.bar {
		display: block;
		height: 4px;
		margin-top: 6px;
		border-radius: 999px;
		background: var(--rule);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
	}
	.figs {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		text-align: right;
	}
</style>

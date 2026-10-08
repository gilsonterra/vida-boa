<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { store } from '#lib/data/index.ts';
	import { today } from '#lib/domain/dates.ts';
	import { LOAN_KIND_LABEL } from '#lib/domain/loans.ts';
	import { centsToInput, parseAmountToCents } from '#lib/domain/money.ts';
	import type {
		AmortizationSystem,
		Loan,
		LoanKind,
		LoanMode,
		NewEntity
	} from '#lib/domain/types.ts';
	import { confirmAction, toast } from '#lib/stores/ui.svelte.ts';
	import Button from './Button.svelte';
	import Segmented from './Segmented.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		open: boolean;
		loan?: Loan | null;
	}
	let { open = $bindable(), loan = null }: Props = $props();

	let name = $state('');
	let kind = $state<LoanKind>('home');
	let mode = $state<LoanMode>('contract');
	let system = $state<AmortizationSystem>('price');
	let principalText = $state('');
	let rateText = $state('');
	let ratePeriod = $state<'month' | 'year'>('year');
	let installmentText = $state('');
	let termText = $state('');
	let firstDueDate = $state(today());
	let paidBeforeText = $state('0');
	let error = $state('');

	// Recarrega o formulário só quando a folha abre (não a cada sincronização).
	$effect(() => {
		if (open) untrack(fill);
	});

	function fill() {
		const l = loan;
		name = l?.name ?? '';
		kind = l?.kind ?? 'home';
		mode = l?.mode ?? 'contract';
		system = l?.system ?? 'price';
		principalText = l && l.mode === 'contract' ? centsToInput(l.principalCents) : '';
		rateText = l && l.mode === 'contract' ? String(l.ratePercent).replace('.', ',') : '';
		ratePeriod = l?.ratePeriod ?? 'year';
		installmentText = l && l.mode === 'simple' ? centsToInput(l.installmentCents) : '';
		termText = l ? String(l.termMonths) : '';
		firstDueDate = l?.firstDueDate ?? today();
		paidBeforeText = String(l?.paidBefore ?? 0);
		error = '';
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		const term = Number(termText);
		const paidBefore = Number(paidBeforeText || 0);
		const rate = Number(rateText.replace(',', '.') || 0);
		const principal = mode === 'contract' ? parseAmountToCents(principalText) : 0;
		const installment = mode === 'simple' ? parseAmountToCents(installmentText) : 0;
		if (!name.trim()) return (error = 'Dê um nome ao financiamento.');
		if (mode === 'contract' && !principal) return (error = 'Informe o valor financiado.');
		if (mode === 'contract' && !(rate >= 0 && rate <= 1000)) return (error = 'Taxa inválida.');
		if (mode === 'simple' && !installment) return (error = 'Informe o valor da parcela.');
		if (!Number.isInteger(term) || term < 1 || term > 600)
			return (error = 'O prazo vai de 1 a 600 parcelas.');
		if (!Number.isInteger(paidBefore) || paidBefore < 0 || paidBefore > term)
			return (error = 'Parcelas já pagas não pode passar do prazo.');

		const fields: NewEntity<Loan> = {
			name: name.trim(),
			kind,
			mode,
			system: mode === 'contract' ? system : 'price',
			principalCents: Math.abs(principal ?? 0),
			ratePercent: mode === 'contract' ? rate : 0,
			ratePeriod,
			installmentCents: Math.abs(installment ?? 0),
			termMonths: term,
			firstDueDate,
			paidBefore
		};
		let id = loan?.id;
		if (loan) await store.loans.update(loan.id, fields);
		else id = (await store.loans.create(fields)).id;
		toast(loan ? 'Financiamento atualizado' : 'Financiamento criado');
		open = false;
		if (!loan && id) void goto(resolve('/financiamentos/[id]', { id }));
	}

	async function remove() {
		if (!loan) return;
		const ok = await confirmAction({
			title: 'Excluir financiamento?',
			message: 'A tabela e as amortizações dele somem. O extrato das contas não muda.',
			confirmLabel: 'Excluir',
			destructive: true
		});
		if (!ok) return;
		await store.loans.remove(loan.id);
		toast('Financiamento excluído');
		open = false;
		void goto(resolve('/contas'));
	}
</script>

<Sheet bind:open title={loan ? 'Editar financiamento' : 'Novo financiamento'}>
	<form id="loan-form" onsubmit={save} novalidate>
		<label>
			<span class="field-label">Nome</span>
			<input class="input" bind:value={name} placeholder="Ex.: Apartamento, Carro" />
		</label>
		<label>
			<span class="field-label">Tipo</span>
			<select class="input" bind:value={kind}>
				{#each Object.entries(LOAN_KIND_LABEL) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</label>
		<Segmented
			label="Como cadastrar"
			bind:value={mode}
			options={[
				{ value: 'contract', label: 'Contrato' },
				{ value: 'simple', label: 'Só a parcela' }
			]}
		/>
		{#if mode === 'contract'}
			<label>
				<span class="field-label">Valor financiado</span>
				<input
					class="input figures"
					inputmode="decimal"
					bind:value={principalText}
					placeholder="0,00"
				/>
			</label>
			<div class="two">
				<label>
					<span class="field-label">Taxa de juros (%)</span>
					<input
						class="input figures"
						inputmode="decimal"
						bind:value={rateText}
						placeholder="0,00"
					/>
				</label>
				<label>
					<span class="field-label">Período da taxa</span>
					<select class="input" bind:value={ratePeriod}>
						<option value="year">Ao ano</option>
						<option value="month">Ao mês</option>
					</select>
				</label>
			</div>
			<Segmented
				label="Sistema de amortização"
				bind:value={system}
				options={[
					{ value: 'price', label: 'Price (parcela fixa)' },
					{ value: 'sac', label: 'SAC (parcela cai)' }
				]}
			/>
		{:else}
			<label>
				<span class="field-label">Valor da parcela</span>
				<input
					class="input figures"
					inputmode="decimal"
					bind:value={installmentText}
					placeholder="0,00"
				/>
			</label>
		{/if}
		<div class="two">
			<label>
				<span class="field-label">Prazo (parcelas)</span>
				<input class="input figures" inputmode="numeric" bind:value={termText} placeholder="360" />
			</label>
			<label>
				<span class="field-label">1ª parcela</span>
				<input class="input" type="date" bind:value={firstDueDate} />
			</label>
		</div>
		<label>
			<span class="field-label">Parcelas já pagas antes do app</span>
			<input class="input figures" inputmode="numeric" bind:value={paidBeforeText} />
			<small>As que já venceram contam como pagas de qualquer forma.</small>
		</label>
		<p class="hint">
			O financiamento só acompanha a dívida: nada é lançado nas contas. O pagamento das parcelas
			aparece no extrato quando você importa ou lança.
		</p>
		{#if error}<p class="err">{error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="actions">
			{#if loan}<Button variant="danger" onclick={remove}>Excluir</Button>{/if}
			<Button type="submit" form="loan-form" size="lg" block>Salvar</Button>
		</div>
	{/snippet}
</Sheet>

<style>
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
	.hint {
		margin: 0;
		font-size: 13px;
		color: var(--ink-2);
	}
	small {
		display: block;
		margin-top: 4px;
		font-size: 13px;
		color: var(--ink-2);
	}
	.err {
		color: var(--danger);
		font-size: 14px;
	}
	.actions {
		display: flex;
		gap: 10px;
	}
</style>

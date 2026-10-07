<script lang="ts">
	import { resolve } from '$app/paths';
	import { Plus } from '@lucide/svelte';
	import { store } from '#lib/data/index.ts';
	import { formatDayShort, today } from '#lib/domain/dates.ts';
	import { centsToInput, parseAmountToCents } from '#lib/domain/money.ts';
	import { FREQUENCY_LABEL } from '#lib/domain/recurrence.ts';
	import type { Frequency, ID, RecurringRule } from '#lib/domain/types.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { confirmAction, toast } from '#lib/stores/ui.svelte.ts';
	import Amount from '#lib/ui/Amount.svelte';
	import Button from '#lib/ui/Button.svelte';
	import CategoryMark from '#lib/ui/CategoryMark.svelte';
	import CategoryPicker from '#lib/ui/CategoryPicker.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';

	const data = useAppData();

	let open = $state(false);
	let editing = $state<RecurringRule | null>(null);
	let description = $state('');
	let amountText = $state('');
	let kind = $state<'expense' | 'income'>('expense');
	let accountId = $state<ID>('');
	let categoryId = $state<ID | null>(null);
	let frequency = $state<Frequency>('monthly');
	let nextDate = $state(today());
	let endDate = $state('');
	let active = $state(true);
	let error = $state('');

	const rules = $derived(
		[...data.recurring].sort(
			(a, b) => Number(b.active) - Number(a.active) || a.nextDate.localeCompare(b.nextDate)
		)
	);
	const monthlyCost = $derived(
		data.recurring
			.filter((r) => r.active && r.kind === 'expense')
			.reduce(
				(s, r) =>
					s +
					(r.frequency === 'monthly'
						? r.amountCents
						: r.frequency === 'weekly'
							? Math.round((r.amountCents * 52) / 12)
							: Math.round(r.amountCents / 12)),
				0
			)
	);

	function edit(r: RecurringRule | null) {
		editing = r;
		description = r?.description ?? '';
		amountText = r ? centsToInput(r.amountCents) : '';
		kind = r?.kind ?? 'expense';
		accountId = r?.accountId ?? data.activeAccounts[0]?.id ?? '';
		categoryId = r?.categoryId ?? null;
		frequency = r?.frequency ?? 'monthly';
		nextDate = r?.nextDate ?? today();
		endDate = r?.endDate ?? '';
		active = r?.active ?? true;
		error = '';
		open = true;
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		const cents = parseAmountToCents(amountText);
		if (!description.trim()) return (error = 'Descreva o lançamento.');
		if (!cents) return (error = 'Informe um valor maior que zero.');
		if (!accountId) return (error = 'Escolha a conta.');
		const fields = {
			description: description.trim(),
			amountCents: Math.abs(cents),
			kind,
			accountId,
			categoryId,
			frequency,
			nextDate,
			endDate: endDate || null,
			active
		};
		// A próxima data passa a ser a âncora do dia (ex.: todo dia 10).
		if (editing) await store.recurring.update(editing.id, { ...fields, startDate: nextDate });
		else await store.recurring.create({ ...fields, startDate: nextDate });
		const created = await store.recurring.materialize(today());
		toast(
			created
				? `${created} lançamento(s) gerado(s)`
				: editing
					? 'Recorrência atualizada'
					: 'Recorrência criada'
		);
		open = false;
	}

	async function remove() {
		if (!editing) return;
		const ok = await confirmAction({
			title: 'Excluir recorrência?',
			message:
				'Os lançamentos já gerados continuam no extrato. Só os próximos deixam de ser criados.',
			confirmLabel: 'Excluir',
			destructive: true
		});
		if (!ok) return;
		await store.recurring.remove(editing.id);
		toast('Recorrência excluída');
		open = false;
	}
</script>

<PageHeader
	title="Recorrentes"
	back={{ href: resolve('/ajustes'), label: 'Ajustes' }}
	subtitle="Aluguel, escola, assinaturas: lançados sozinhos na data, sempre que você abrir o app."
>
	{#snippet actions()}
		<IconButton tone="hi" label="Nova recorrência" onclick={() => edit(null)}
			><Plus size={22} strokeWidth={1.6} /></IconButton
		>
	{/snippet}
</PageHeader>

<div class="page">
	{#if rules.length}
		<div class="cost">
			<span>Compromisso mensal com despesas fixas</span>
			<Amount cents={-monthlyCost} size="md" tone="loss" />
		</div>
		<ul>
			{#each rules as r (r.id)}
				<li>
					<button type="button" class="row item" class:off={!r.active} onclick={() => edit(r)}>
						<CategoryMark
							category={r.categoryId ? data.categoryById.get(r.categoryId) : undefined}
						/>
						<span class="main">
							<span>{r.description}</span>
							<small>
								{FREQUENCY_LABEL[r.frequency]}{r.active
									? `, próximo em ${formatDayShort(r.nextDate)}`
									: ', pausada'}
							</small>
						</span>
						<Amount
							cents={r.kind === 'expense' ? -r.amountCents : r.amountCents}
							size="sm"
							signed
							tone="auto"
						/>
					</button>
				</li>
			{/each}
		</ul>
	{:else if data.ready}
		<EmptyState
			title="Nenhuma recorrência"
			text="Cadastre despesas e receitas fixas para que entrem sozinhas no extrato."
		>
			<Button onclick={() => edit(null)}>Nova recorrência</Button>
		</EmptyState>
	{/if}
</div>

<Sheet bind:open title={editing ? 'Editar recorrência' : 'Nova recorrência'}>
	<form id="rec-form" onsubmit={save} novalidate>
		<Segmented
			label="Natureza"
			bind:value={kind}
			onchange={() => (categoryId = null)}
			options={[
				{ value: 'expense', label: 'Despesa' },
				{ value: 'income', label: 'Receita' }
			]}
		/>
		<label>
			<span class="field-label">Descrição</span>
			<input class="input" bind:value={description} placeholder="Ex.: Condomínio" />
		</label>
		<div class="two">
			<label>
				<span class="field-label">Valor</span>
				<input
					class="input figures"
					inputmode="decimal"
					bind:value={amountText}
					placeholder="0,00"
				/>
			</label>
			<label>
				<span class="field-label">Frequência</span>
				<select class="input" bind:value={frequency}>
					<option value="weekly">Semanal</option>
					<option value="monthly">Mensal</option>
					<option value="yearly">Anual</option>
				</select>
			</label>
		</div>
		<div class="two">
			<label>
				<span class="field-label">Próxima data</span>
				<input class="input" type="date" bind:value={nextDate} />
			</label>
			<label>
				<span class="field-label">Termina em</span>
				<input class="input" type="date" bind:value={endDate} />
			</label>
		</div>
		<label>
			<span class="field-label">Conta</span>
			<select class="input" bind:value={accountId}>
				{#each data.activeAccounts as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
			</select>
		</label>
		<div>
			<span class="field-label">Categoria</span>
			<CategoryPicker bind:value={categoryId} {kind} />
		</div>
		{#if editing}
			<label class="check">
				<input type="checkbox" bind:checked={active} />
				<span>Ativa</span>
			</label>
		{/if}
		{#if error}<p class="err">{error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="actions">
			{#if editing}<Button variant="danger" onclick={remove}>Excluir</Button>{/if}
			<Button type="submit" form="rec-form" size="lg" block>Salvar</Button>
		</div>
	{/snippet}
</Sheet>

<style>
	.page {
		padding-inline: 20px;
	}
	.cost {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 14px 0;
		margin-bottom: 8px;
		border-block: 1px solid var(--rule);
	}
	.cost span {
		font-size: 13px;
		color: var(--ink-2);
	}
	.item {
		width: 100%;
		text-align: left;
	}
	.item.off {
		opacity: 0.5;
	}
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	small {
		font-size: 13px;
		color: var(--ink-2);
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
	.check {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.check input {
		width: 18px;
		height: 18px;
		accent-color: var(--accent);
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

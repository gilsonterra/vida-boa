<script lang="ts">
	import { untrack } from 'svelte';
	import * as v from 'valibot';
	import { store } from '../data';
	import { today } from '../domain/dates';
	import { centsToInput, formatCents, parseAmountToCents } from '../domain/money';
	import { FREQUENCY_LABEL } from '../domain/recurrence';
	import { merchantKey, normalizeText } from '../domain/text';
	import type { Frequency, ID, Transaction, TransactionKind } from '../domain/types';
	import { useAppData } from '../stores/data.svelte';
	import {
		closeEditor,
		confirmAction,
		haptic,
		toast,
		type EditorRequest
	} from '../stores/ui.svelte';
	import Button from './Button.svelte';
	import CategoryPicker from './CategoryPicker.svelte';
	import Segmented from './Segmented.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		request: EditorRequest;
	}

	let { request }: Props = $props();
	const data = useAppData();

	// O formulário copia o pedido uma única vez, na abertura (o editor é recriado a cada pedido).
	const { transaction: original, defaults } = untrack(() => request);
	const partner = original ? data.partnerOf(original) : undefined;
	const outLeg =
		original?.kind === 'transfer' && partner && original.amountCents > 0 ? partner : original;
	const inLeg = outLeg === original ? partner : original;

	let open = $state(true);
	let kind = $state<TransactionKind>(original?.kind ?? defaults?.kind ?? 'expense');
	let amountText = $state(original ? centsToInput(original.amountCents) : '');
	let description = $state(original?.description ?? '');
	let date = $state(original?.date ?? today());
	let accountId = $state<ID>(
		outLeg?.accountId ?? defaults?.accountId ?? data.activeAccounts[0]?.id ?? ''
	);
	let toAccountId = $state<ID>(inLeg?.accountId ?? '');
	let categoryId = $state<ID | null>(original?.categoryId ?? null);
	let notes = $state(original?.notes ?? '');
	let refund = $state(original?.kind === 'expense' && original.amountCents > 0);
	let repeat = $state<'none' | Frequency>('none');
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);

	const isNew = !original;
	const title = $derived(
		!isNew ? 'Editar lançamento' : kind === 'transfer' ? 'Nova transferência' : 'Novo lançamento'
	);

	const accountOptions = $derived(
		data.accounts.filter((a) => !a.archived || a.id === accountId || a.id === toAccountId)
	);
	const hasAccounts = $derived(data.activeAccounts.length > 0);
	/** Lançamento único em edição virando transferência: a outra conta é contraparte. */
	const converting = $derived(!!original && original.kind !== 'transfer' && kind === 'transfer');
	const sourceLabel = $derived(
		kind !== 'transfer'
			? 'Conta'
			: converting && original!.amountCents > 0
				? 'Recebido em'
				: 'Sai de'
	);
	const targetLabel = $derived(converting && original!.amountCents > 0 ? 'Veio de' : 'Vai para');

	$effect(() => {
		// Ao trocar entre despesa e receita, a categoria anterior deixa de valer.
		const c = categoryId ? data.categoryById.get(categoryId) : undefined;
		if (c && kind !== 'transfer' && c.kind !== kind) categoryId = null;
	});

	const Schema = v.object({
		amountCents: v.pipe(v.number(), v.minValue(1, 'Informe um valor maior que zero.')),
		description: v.pipe(v.string(), v.trim(), v.nonEmpty('Descreva o lançamento.')),
		date: v.pipe(v.string(), v.isoDate('Informe uma data válida.')),
		accountId: v.pipe(v.string(), v.nonEmpty('Escolha a conta.'))
	});

	function validate() {
		const amount = parseAmountToCents(amountText);
		const result = v.safeParse(Schema, {
			amountCents: amount === null ? 0 : Math.abs(amount),
			description,
			date,
			accountId
		});
		const next: Record<string, string> = {};
		if (!result.success) {
			for (const issue of result.issues) {
				const key = v.getDotPath(issue);
				if (key && !next[key]) next[key] = issue.message;
			}
		}
		// Uma transferência já existente sem par (ex.: pagamento de fatura importado) pode continuar sem par.
		const mayStayUnpaired = original?.kind === 'transfer';
		if (kind === 'transfer' && !toAccountId && !mayStayUnpaired) {
			next.toAccountId = 'Escolha a outra conta.';
		}
		if (kind === 'transfer' && toAccountId && toAccountId === accountId) {
			next.toAccountId = 'Escolha uma conta diferente.';
		}
		errors = next;
		return result.success && Object.keys(next).length === 0 ? Math.abs(amount!) : null;
	}

	function signed(cents: number): number {
		if (kind === 'income') return cents;
		if (kind === 'expense') return refund ? cents : -cents;
		return cents;
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		const cents = validate();
		if (cents === null || saving) return;
		saving = true;
		try {
			const desc = description.trim();
			if (isNew) await create(cents, desc);
			else await update(original!, cents, desc);
			haptic();
			close();
		} catch (err) {
			toast((err as Error).message || 'Não foi possível salvar.');
		} finally {
			saving = false;
		}
	}

	async function create(cents: number, desc: string) {
		if (kind === 'transfer') {
			await store.transactions.createTransfer({
				fromAccountId: accountId,
				toAccountId,
				amountCents: cents,
				date,
				description: desc,
				notes
			});
			toast('Transferência registrada');
			return;
		}
		if (repeat !== 'none') {
			await store.recurring.create({
				description: desc,
				accountId,
				categoryId,
				kind,
				amountCents: cents,
				frequency: repeat,
				startDate: date,
				endDate: null,
				nextDate: date,
				active: true
			});
			const created = await store.recurring.materialize(today());
			toast(
				created
					? `Lançamento ${FREQUENCY_LABEL[repeat].toLowerCase()} criado`
					: 'Recorrência agendada'
			);
			return;
		}
		await store.transactions.create({
			accountId,
			date,
			amountCents: signed(cents),
			description: desc,
			notes,
			kind,
			categoryId,
			transferId: null,
			fitId: null,
			importBatchId: null,
			recurringId: null
		});
		toast(kind === 'income' ? 'Receita registrada' : 'Despesa registrada');
	}

	async function update(t: Transaction, cents: number, desc: string) {
		if (t.kind === 'transfer') {
			if (kind === 'transfer') {
				const out = outLeg!;
				await store.transactions.update(out.id, {
					amountCents: -cents,
					date,
					description: desc,
					notes,
					accountId
				});
				if (inLeg) {
					await store.transactions.update(inLeg.id, {
						description: desc,
						notes,
						accountId: toAccountId
					});
				} else if (toAccountId) {
					await store.transactions.convertToTransfer(out.id, toAccountId);
				}
			} else {
				await store.transactions.unlinkTransfer(t.id);
				await store.transactions.update(t.id, {
					kind,
					amountCents: signed(cents),
					categoryId,
					description: desc,
					notes,
					date,
					accountId
				});
			}
			toast('Lançamento atualizado');
			return;
		}

		if (kind === 'transfer') {
			await store.transactions.update(t.id, {
				amountCents: t.amountCents < 0 ? -cents : cents,
				description: desc,
				notes,
				date,
				accountId
			});
			await store.transactions.convertToTransfer(t.id, toAccountId);
			toast('Convertido em transferência');
			return;
		}

		await store.transactions.update(t.id, {
			kind,
			amountCents: signed(cents),
			categoryId,
			description: desc,
			notes,
			date,
			accountId
		});
		if (categoryId && categoryId !== t.categoryId) offerApplyToSimilar(t, desc, categoryId);
		else toast('Lançamento atualizado');
	}

	/** Depois de categorizar, oferece aplicar aos parecidos e criar uma regra para o futuro. */
	function offerApplyToSimilar(t: Transaction, desc: string, catId: ID) {
		const key = merchantKey(desc);
		if (!key) return toast('Lançamento atualizado');
		const similar = data.transactions.filter(
			(o) =>
				o.id !== t.id &&
				o.kind !== 'transfer' &&
				o.categoryId !== catId &&
				merchantKey(o.description) === key
		);
		const category = data.categoryById.get(catId)!;
		const hasRule = data.rules.some((r) => normalizeText(r.pattern) === key);
		if (similar.length === 0 && hasRule) return toast('Lançamento atualizado');

		const label = similar.length
			? `Aplicar a ${similar.length} parecido${similar.length > 1 ? 's' : ''}`
			: 'Sempre usar';
		toast(`Categoria: ${category.name}`, {
			label,
			run: async () => {
				if (similar.length)
					await store.transactions.setCategory(
						similar.map((s) => s.id),
						catId
					);
				if (!hasRule) {
					await store.rules.create({
						pattern: key,
						matchType: 'contains',
						categoryId: catId,
						accountId: null,
						priority: 10,
						isSystem: false
					});
				}
				toast(
					similar.length
						? `${similar.length} lançamentos atualizados e regra criada`
						: 'Regra criada'
				);
			}
		});
	}

	async function remove() {
		const t = original!;
		const ok = await confirmAction({
			title: 'Excluir lançamento?',
			message:
				t.kind === 'transfer'
					? 'As duas pernas da transferência serão excluídas.'
					: `“${t.description}”, ${formatCents(t.amountCents)}.`,
			confirmLabel: 'Excluir',
			destructive: true
		});
		if (!ok) return;
		await store.transactions.remove(t.id);
		close();
		toast('Lançamento excluído', {
			label: 'Desfazer',
			run: () => store.transactions.restore(t.id)
		});
	}

	function close() {
		open = false;
		// Espera a animação de saída antes de desmontar.
		setTimeout(closeEditor, 280);
	}

	function formatAmount() {
		const cents = parseAmountToCents(amountText);
		if (cents !== null) amountText = centsToInput(cents);
	}
</script>

<Sheet bind:open {title} onclose={close}>
	{#if !hasAccounts}
		<p class="note">Cadastre uma conta em Ajustes antes de lançar.</p>
	{:else}
		<form id="tx-form" onsubmit={save} novalidate>
			<Segmented
				label="Tipo de lançamento"
				bind:value={kind}
				options={[
					{ value: 'expense', label: 'Despesa' },
					{ value: 'income', label: 'Receita' },
					{ value: 'transfer', label: 'Transferência' }
				]}
			/>

			<label class="amount" class:error={errors.amountCents}>
				<span class="sr-only">Valor</span>
				<span class="cur" aria-hidden="true">R$</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					inputmode="decimal"
					placeholder="0,00"
					bind:value={amountText}
					onblur={formatAmount}
					autofocus={isNew}
					autocomplete="off"
				/>
			</label>
			{#if errors.amountCents}<p class="err center">{errors.amountCents}</p>{/if}

			<div class="fields">
				<label>
					<span class="field-label">Descrição</span>
					<input
						class="input"
						bind:value={description}
						placeholder={kind === 'transfer' ? 'Ex.: Pagamento da fatura' : 'Ex.: Jantar no Fasano'}
						autocomplete="off"
					/>
					{#if errors.description}<span class="err">{errors.description}</span>{/if}
				</label>

				<div class="two">
					<label>
						<span class="field-label">Data</span>
						<input class="input" type="date" bind:value={date} />
						{#if errors.date}<span class="err">{errors.date}</span>{/if}
					</label>
					<label>
						<span class="field-label">{sourceLabel}</span>
						<select class="input" bind:value={accountId}>
							{#each accountOptions as a (a.id)}
								<option value={a.id}>{a.name}</option>
							{/each}
						</select>
						{#if errors.accountId}<span class="err">{errors.accountId}</span>{/if}
					</label>
				</div>

				{#if kind === 'transfer'}
					<label>
						<span class="field-label">{targetLabel}</span>
						<select class="input" bind:value={toAccountId}>
							<option value="" disabled>Escolher conta</option>
							{#each accountOptions.filter((a) => a.id !== accountId) as a (a.id)}
								<option value={a.id}>{a.name}</option>
							{/each}
						</select>
						{#if errors.toAccountId}<span class="err">{errors.toAccountId}</span>{/if}
						{#if converting}
							<span class="hint"
								>Se já houver o lançamento oposto nessa conta, os dois serão pareados.</span
							>
						{/if}
					</label>
				{:else}
					<div>
						<span class="field-label">Categoria</span>
						<CategoryPicker
							bind:value={categoryId}
							kind={kind === 'income' ? 'income' : 'expense'}
						/>
					</div>
				{/if}

				{#if kind === 'expense' && !isNew}
					<label class="check">
						<input type="checkbox" bind:checked={refund} />
						<span>Estorno <small>entra como crédito e abate a despesa da categoria</small></span>
					</label>
				{/if}

				{#if isNew && kind !== 'transfer'}
					<label>
						<span class="field-label">Repetir</span>
						<select class="input" bind:value={repeat}>
							<option value="none">Não repetir</option>
							<option value="weekly">Toda semana</option>
							<option value="monthly">Todo mês</option>
							<option value="yearly">Todo ano</option>
						</select>
					</label>
				{/if}

				{#if original?.recurringId}
					<p class="note">
						Gerado por uma recorrência. Para mudar as próximas, use Ajustes › Recorrentes.
					</p>
				{/if}

				<label>
					<span class="field-label">Observações</span>
					<textarea class="input" rows="2" bind:value={notes}></textarea>
				</label>
			</div>
		</form>
	{/if}

	{#snippet footer()}
		<div class="actions">
			{#if !isNew}
				<Button variant="danger" onclick={remove}>Excluir</Button>
			{/if}
			<Button type="submit" form="tx-form" size="lg" block disabled={saving || !hasAccounts}>
				{isNew ? 'Salvar' : 'Salvar alterações'}
			</Button>
		</div>
	{/snippet}
</Sheet>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.amount {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 8px;
		padding: 26px 0 10px;
	}
	.amount .cur {
		font-family: var(--font-serif);
		font-size: 22px;
		color: var(--ink-3);
	}
	.amount input {
		width: 7.5ch;
		min-width: 0;
		background: none;
		border: 0;
		outline: none;
		text-align: left;
		font-family: var(--font-serif);
		font-size: 52px;
		font-weight: 300;
		font-variation-settings: 'opsz' 144;
		letter-spacing: -0.03em;
		font-variant-numeric: lining-nums tabular-nums;
	}
	.amount input::placeholder {
		color: var(--rule-strong);
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-top: 8px;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.err {
		display: block;
		margin-top: 6px;
		font-size: 13px;
		color: var(--danger);
	}
	.center {
		text-align: center;
		margin-top: -4px;
	}
	.hint {
		display: block;
		margin-top: 6px;
		font-size: 13px;
		color: var(--ink-3);
	}
	.note {
		font-size: 14px;
		color: var(--ink-2);
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--sunken);
	}
	.check {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		font-size: 15px;
	}
	.check input {
		margin-top: 4px;
		accent-color: var(--accent);
		width: 18px;
		height: 18px;
	}
	.check small {
		display: block;
		color: var(--ink-3);
		font-size: 13px;
	}
	.actions {
		display: flex;
		gap: 10px;
	}
	textarea.input {
		resize: vertical;
		min-height: 64px;
	}
</style>

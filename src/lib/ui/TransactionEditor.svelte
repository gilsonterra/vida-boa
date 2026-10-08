<script lang="ts">
	import { untrack } from 'svelte';
	import * as v from 'valibot';
	import { store } from '../data';
	import { formatDayShort, formatDayShortYear, nextOccurrence, today } from '../domain/dates';
	import { defaultConsolidated, isConsolidated } from '../domain/ledger';
	import { centsToInput, formatCents, parseAmountToCents } from '../domain/money';
	import { FREQUENCY_LABEL, upcomingDates } from '../domain/recurrence';
	import { merchantKey, normalizeText } from '../domain/text';
	import type { Frequency, ID, RecurringRule, Transaction, TransactionKind } from '../domain/types';
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
	const { transaction: original, occurrence, defaults } = untrack(() => request);
	/** Recorrência por trás do que está sendo editado (ocorrência prevista ou já lançada). */
	const rule =
		occurrence?.rule ??
		(original?.recurringId ? data.recurring.find((r) => r.id === original.recurringId) : undefined);
	/** Valores de partida: o lançamento, ou a recorrência para uma ocorrência prevista. */
	const seed = original ?? (occurrence ? fromRule(occurrence.rule, occurrence.date) : undefined);

	function fromRule(r: RecurringRule, d: string) {
		return {
			kind: r.kind as TransactionKind,
			amountCents: r.kind === 'expense' ? -r.amountCents : r.amountCents,
			description: r.description,
			date: d,
			accountId: r.accountId,
			categoryId: r.categoryId,
			notes: ''
		};
	}
	const partner = original ? data.partnerOf(original) : undefined;
	const outLeg =
		original?.kind === 'transfer' && partner && original.amountCents > 0 ? partner : original;
	const inLeg = outLeg === original ? partner : original;

	let open = $state(true);
	let kind = $state<TransactionKind>(seed?.kind ?? defaults?.kind ?? 'expense');
	let amountText = $state(seed ? centsToInput(seed.amountCents) : '');
	let description = $state(seed?.description ?? '');
	let date = $state(seed?.date ?? today());
	let accountId = $state<ID>(
		outLeg?.accountId ?? seed?.accountId ?? defaults?.accountId ?? data.activeAccounts[0]?.id ?? ''
	);
	let toAccountId = $state<ID>(inLeg?.accountId ?? '');
	let categoryId = $state<ID | null>(seed?.categoryId ?? null);
	let notes = $state(seed?.notes ?? '');
	let refund = $state(original?.kind === 'expense' && original.amountCents > 0);
	let repeat = $state<'none' | Frequency>(rule?.frequency ?? 'none');
	/** Como a recorrência termina: nunca, numa data ou depois de N vezes (parcelas). */
	let endMode = $state<'never' | 'date' | 'count'>(rule?.endDate ? 'date' : 'never');
	let endDate = $state(rule?.endDate ?? '');
	/** Numa recorrência: a mudança vale só para esta ocorrência ou para esta e as próximas. */
	let scope = $state<'one' | 'next'>('one');
	let times = $state(12);
	/**
	 * Só consolidado conta no saldo. Num lançamento novo, segue a data até você marcar à mão
	 * (data futura nasce pendente). Transferência é sempre consolidada.
	 */
	let consolidated = $state(original ? isConsolidated(original) : true);
	// Ao editar, o valor gravado vale; não muda sozinho com a data (a ocorrência prevista, sim).
	let consolidatedTouched = !!original;
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);

	const isNew = !original && !occurrence;
	/** Campos de repetição: ao criar, num lançamento avulso, ou mudando "esta e as próximas". */
	const showRepeat = $derived(kind !== 'transfer' && (!rule || scope === 'next'));
	/** Próximas datas da recorrência, para dar contexto. */
	const upcoming = $derived(rule ? upcomingDates(rule, 3) : []);
	const FREQUENCY_PHRASE = { weekly: 'toda semana', monthly: 'todo mês', yearly: 'todo ano' };

	/** Data da última ocorrência, conforme o término escolhido (`null` = sem fim). */
	const lastDate = $derived.by(() => {
		if (repeat === 'none' || endMode === 'never') return null;
		if (endMode === 'date') return endDate || null;
		if (!(times >= 1)) return null;
		// Este lançamento é a 1ª vez; a N-ésima fecha a recorrência.
		let d = date;
		for (let i = 1; i < Math.min(times, 600); i++) d = nextOccurrence(d, repeat, date);
		return d;
	});

	/**
	 * Próxima ocorrência ao tornar recorrente um lançamento já gravado: a seguinte a ele, mas
	 * nunca no passado (as de antes de hoje já devem estar no extrato do banco).
	 */
	function firstNext(from: string, frequency: Frequency): string {
		const now = today();
		let next = nextOccurrence(from, frequency, from);
		while (next < now) next = nextOccurrence(next, frequency, from);
		return next;
	}
	const title = $derived(
		occurrence
			? 'Lançamento previsto'
			: !isNew
				? 'Editar lançamento'
				: kind === 'transfer'
					? 'Nova transferência'
					: 'Novo lançamento'
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
		// Data futura nasce pendente; hoje ou antes, consolidado.
		const d = date;
		if (!consolidatedTouched) consolidated = defaultConsolidated(d, today());
	});

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
		if (repeat !== 'none' && endMode === 'date' && (!endDate || endDate < date)) {
			next.endDate = 'Escolha um término depois da data.';
		}
		if (repeat !== 'none' && endMode === 'count' && !(times >= 2 && Number.isInteger(times))) {
			next.endDate = 'Informe 2 vezes ou mais.';
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
			if (rule && scope === 'next') await updateSeries(cents, desc);
			else if (occurrence) await launchThis(cents, desc);
			else if (isNew) await create(cents, desc);
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
				endDate: lastDate,
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
			recurringId: null,
			consolidated
		});
		toast(kind === 'income' ? 'Receita registrada' : 'Despesa registrada');
	}

	/** Valores de despesa/receita do formulário, para lançar ou atualizar. */
	function txFields(cents: number, desc: string) {
		return {
			kind,
			amountCents: signed(cents),
			categoryId,
			description: desc,
			notes,
			date,
			accountId,
			consolidated
		};
	}

	/** Só esta ocorrência prevista: vira lançamento com os valores editados. */
	async function launchThis(cents: number, desc: string) {
		const r = occurrence!.rule;
		const id = await store.recurring.launchOccurrence(
			r.id,
			occurrence!.date,
			txFields(cents, desc)
		);
		toast(id ? 'Lançamento salvo' : 'Essa ocorrência já foi lançada');
	}

	/**
	 * Esta e as próximas: a recorrência antiga termina antes desta data e uma nova começa nela
	 * com os valores novos (as anteriores ficam como estavam). "Não repetir" só encerra.
	 */
	async function updateSeries(cents: number, desc: string) {
		const r = rule!;
		const from = occurrence?.date ?? original!.date;
		if (original) await store.transactions.update(original.id, txFields(cents, desc));
		await store.recurring.endBefore(
			r.id,
			original ? nextOccurrence(from, r.frequency, r.startDate) : from
		);
		if (repeat === 'none') {
			// Esta fica como a última.
			if (occurrence) await store.recurring.launchOccurrence(r.id, from, txFields(cents, desc));
			toast('Recorrência encerrada');
			return;
		}
		const created = await store.recurring.create({
			description: desc,
			accountId,
			categoryId,
			kind: kind === 'income' ? 'income' : 'expense',
			amountCents: cents,
			frequency: repeat,
			startDate: date,
			endDate: lastDate,
			// Num lançamento já gravado, ele mesmo é a 1ª vez; a nova começa na seguinte.
			nextDate: original ? firstNext(date, repeat) : date,
			active: true
		});
		if (original) await store.transactions.update(original.id, { recurringId: created.id });
		else if (consolidated)
			await store.recurring.launchOccurrence(created.id, date, txFields(cents, desc));
		await store.recurring.materialize(today());
		toast('Esta e as próximas atualizadas');
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
					accountId,
					consolidated
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
				accountId,
				consolidated
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
			accountId,
			consolidated
		});
		if (repeat !== 'none' && !rule) {
			// Este lançamento vira a primeira ocorrência; as próximas são lançadas quando vencerem.
			const created = await store.recurring.create({
				description: desc,
				accountId,
				categoryId,
				kind: kind === 'income' ? 'income' : 'expense',
				amountCents: cents,
				frequency: repeat,
				startDate: date,
				endDate: lastDate,
				nextDate: firstNext(date, repeat),
				active: true
			});
			await store.transactions.update(t.id, { recurringId: created.id });
			await store.recurring.materialize(today());
			toast(`Agora se repete ${FREQUENCY_PHRASE[repeat]}`);
			return;
		}
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
		if (rule && (occurrence || scope === 'next')) return removeSeries();
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

	/** Excluir numa recorrência: pula só esta, ou encerra a partir desta. */
	async function removeSeries() {
		const r = rule!;
		const from = occurrence?.date ?? original!.date;
		const all = scope === 'next';
		const ok = await confirmAction({
			title: all ? 'Encerrar a recorrência?' : 'Pular esta ocorrência?',
			message: all
				? `“${r.description}” deixa de se repetir a partir de ${formatDayShortYear(from)}. As anteriores continuam no extrato.`
				: `Só a de ${formatDayShortYear(from)} sai; as próximas continuam.`,
			confirmLabel: all ? 'Encerrar' : 'Pular',
			destructive: true
		});
		if (!ok) return;
		if (original) await store.transactions.remove(original.id);
		else await store.recurring.skipOccurrence(r.id, from);
		if (all) await store.recurring.endBefore(r.id, from);
		close();
		toast(all ? 'Recorrência encerrada' : 'Ocorrência pulada');
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

				{#if kind !== 'transfer' && !(isNew && repeat !== 'none')}
					<label class="check">
						<input
							type="checkbox"
							bind:checked={consolidated}
							onchange={() => (consolidatedTouched = true)}
						/>
						<span
							>Consolidado <small
								>{consolidated
									? 'já pago ou recebido; conta no saldo'
									: 'pendente; só conta no saldo depois de confirmado'}</small
							></span
						>
					</label>
				{/if}

				{#if kind === 'expense' && !isNew}
					<label class="check">
						<input type="checkbox" bind:checked={refund} />
						<span>Estorno <small>entra como crédito e abate a despesa da categoria</small></span>
					</label>
				{/if}

				{#if rule}
					<div class="series">
						<p class="note">
							Repete {FREQUENCY_PHRASE[rule.frequency]}{rule.endDate
								? ` até ${formatDayShortYear(rule.endDate)}`
								: ''}{#if upcoming.length}. Próximas: {upcoming
									.map((d) => formatDayShort(d))
									.join(', ')}{/if}.
						</p>
						<Segmented
							label="O que alterar"
							bind:value={scope}
							options={[
								{ value: 'one', label: occurrence ? 'Só esta' : 'Só este' },
								{ value: 'next', label: occurrence ? 'Esta e as próximas' : 'Este e os próximos' }
							]}
						/>
					</div>
				{/if}

				{#if showRepeat}
					<label>
						<span class="field-label">Repetir</span>
						<select class="input" bind:value={repeat}>
							<option value="none">Não repetir</option>
							<option value="weekly">Toda semana</option>
							<option value="monthly">Todo mês</option>
							<option value="yearly">Todo ano</option>
						</select>
						{#if original && !rule && repeat !== 'none'}
							<span class="hint"
								>Este lançamento fica como está; a próxima vez é em {formatDayShortYear(
									firstNext(date, repeat)
								)}.</span
							>
						{/if}
					</label>
					{#if repeat !== 'none'}
						<div class="ends">
							<span class="field-label">Termina</span>
							<Segmented
								label="Como a recorrência termina"
								bind:value={endMode}
								options={[
									{ value: 'never', label: 'Sem fim' },
									{ value: 'date', label: 'Na data' },
									{ value: 'count', label: 'Nº de vezes' }
								]}
							/>
							{#if endMode === 'date'}
								<input
									class="input"
									type="date"
									min={date}
									bind:value={endDate}
									aria-label="Data de término"
								/>
							{:else if endMode === 'count'}
								<input
									class="input"
									type="number"
									inputmode="numeric"
									min="2"
									max="600"
									bind:value={times}
									aria-label="Quantidade de vezes, contando esta"
								/>
							{/if}
							{#if errors.endDate}<span class="err">{errors.endDate}</span>
							{:else}<span class="hint">
									{#if endMode === 'never'}Repete até você pausar.
									{:else if lastDate}Última vez em {formatDayShortYear(lastDate)}{endMode ===
										'count'
											? `, contando esta como a 1ª de ${times}`
											: ''}.{/if}
								</span>{/if}
						</div>
					{/if}
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
				<Button variant="danger" onclick={remove}
					>{rule && (occurrence || scope === 'next')
						? scope === 'next'
							? 'Encerrar'
							: 'Pular'
						: 'Excluir'}</Button
				>
			{/if}
			<Button type="submit" form="tx-form" size="lg" block disabled={saving || !hasAccounts}>
				{isNew ? 'Salvar' : 'Salvar alterações'}
			</Button>
		</div>
	{/snippet}
</Sheet>

<style>
	.series {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.ends {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
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
		font-family: var(--font-display);
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
		font-family: var(--font-display);
		font-size: 52px;
		font-weight: 300;
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

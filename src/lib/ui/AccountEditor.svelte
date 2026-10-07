<script lang="ts">
	import { untrack } from 'svelte';
	import { store } from '../data';
	import { centsToInput, parseAmountToCents } from '../domain/money';
	import { PALETTE } from '../domain/seed';
	import type { Account } from '../domain/types';
	import { useAppData } from '../stores/data.svelte';
	import { confirmAction, haptic, toast } from '../stores/ui.svelte';
	import Button from './Button.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		open: boolean;
		account?: Account;
		onsaved?: (account: Account) => void;
	}

	let { open = $bindable(), account, onsaved }: Props = $props();
	const data = useAppData();

	let name = $state('');
	let typeId = $state('');
	let institution = $state('');
	let color = $state<string>(PALETTE[0]);
	let balanceText = $state('');
	let negative = $state(false);
	let archived = $state(false);
	let error = $state('');

	// Recarrega o formulário toda vez que a sheet abre.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			const a = account;
			name = a?.name ?? '';
			typeId = a?.typeId ?? data.types[0]?.id ?? '';
			institution = a?.institution ?? '';
			color = a?.color ?? PALETTE[data.accounts.length % PALETTE.length];
			balanceText = a ? centsToInput(a.initialBalanceCents) : '';
			negative = (a?.initialBalanceCents ?? 0) < 0;
			archived = a?.archived ?? false;
			error = '';
		});
	});

	const isCard = $derived(data.typeById.get(typeId)?.kind === 'credit_card');
	const txCount = $derived(
		account ? data.transactions.filter((t) => t.accountId === account.id).length : 0
	);

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) return (error = 'Dê um nome à conta.');
		const parsed = balanceText.trim() ? parseAmountToCents(balanceText) : 0;
		if (parsed === null) return (error = 'Saldo inicial inválido.');
		const abs = Math.abs(parsed);
		// No cartão, o valor digitado é a dívida em aberto: entra negativo.
		const initialBalanceCents = isCard || negative ? -abs : abs;
		const fields = {
			name: name.trim(),
			typeId,
			institution: institution.trim(),
			color,
			initialBalanceCents,
			archived
		};

		if (account) {
			await store.accounts.update(account.id, fields);
			toast('Conta atualizada');
			onsaved?.({ ...account, ...fields });
		} else {
			const created = await store.accounts.create({
				...fields,
				currency: 'BRL',
				ofxBankId: null,
				ofxAccountId: null
			});
			toast('Conta criada');
			onsaved?.(created);
		}
		haptic();
		open = false;
	}

	async function remove() {
		if (!account) return;
		if (txCount > 0) {
			const ok = await confirmAction({
				title: 'Arquivar conta?',
				message: `Esta conta tem ${txCount} lançamentos, que continuarão no extrato. Ela sai das listas e dos totais do Início.`,
				confirmLabel: 'Arquivar'
			});
			if (!ok) return;
			await store.accounts.update(account.id, { archived: true });
			toast('Conta arquivada');
		} else {
			const ok = await confirmAction({
				title: 'Excluir conta?',
				message: `“${account.name}” não tem lançamentos e será removida.`,
				confirmLabel: 'Excluir',
				destructive: true
			});
			if (!ok) return;
			await store.accounts.remove(account.id);
			toast('Conta excluída');
		}
		open = false;
	}
</script>

<Sheet bind:open title={account ? 'Editar conta' : 'Nova conta'}>
	<form id="account-form" onsubmit={save} novalidate>
		<label>
			<span class="field-label">Nome</span>
			<input
				class="input"
				bind:value={name}
				placeholder="Ex.: Itaú Personnalité"
				autocomplete="off"
			/>
		</label>
		<div class="two">
			<label>
				<span class="field-label">Tipo</span>
				<select class="input" bind:value={typeId}>
					{#each data.types as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
				</select>
			</label>
			<label>
				<span class="field-label">Instituição</span>
				<input class="input" bind:value={institution} placeholder="Opcional" autocomplete="off" />
			</label>
		</div>
		<label>
			<span class="field-label">{isCard ? 'Fatura em aberto hoje' : 'Saldo inicial'}</span>
			<input
				class="input figures"
				inputmode="decimal"
				bind:value={balanceText}
				placeholder="0,00"
			/>
			<span class="hint">
				{isCard
					? 'Entra como dívida. Os lançamentos importados depois ajustam o valor.'
					: 'O saldo da conta antes do primeiro lançamento registrado aqui.'}
			</span>
		</label>
		{#if !isCard}
			<label class="check">
				<input type="checkbox" bind:checked={negative} />
				<span>Saldo inicial negativo (cheque especial)</span>
			</label>
		{/if}
		<fieldset>
			<legend class="field-label">Cor</legend>
			<div class="swatches">
				{#each PALETTE as c (c)}
					<button
						type="button"
						class="swatch"
						class:on={c === color}
						style:background={c}
						aria-label="Cor {c}"
						aria-pressed={c === color}
						onclick={() => (color = c)}
					></button>
				{/each}
			</div>
		</fieldset>
		{#if account}
			<label class="check">
				<input type="checkbox" bind:checked={archived} />
				<span>Conta arquivada <small>não aparece nas listas nem no patrimônio</small></span>
			</label>
		{/if}
		{#if error}<p class="err">{error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="actions">
			{#if account}
				<Button variant="danger" onclick={remove}>{txCount ? 'Arquivar' : 'Excluir'}</Button>
			{/if}
			<Button type="submit" form="account-form" size="lg" block>Salvar conta</Button>
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
		display: block;
		margin-top: 6px;
		font-size: 13px;
		color: var(--ink-3);
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.swatch {
		width: 32px;
		height: 32px;
		border-radius: 99px;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
	}
	.swatch.on {
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 4px var(--ink);
	}
	.check {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.check input {
		margin-top: 4px;
		width: 18px;
		height: 18px;
		accent-color: var(--accent);
	}
	.check small {
		display: block;
		color: var(--ink-3);
		font-size: 13px;
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

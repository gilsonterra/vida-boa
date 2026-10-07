<script lang="ts">
	import { resolve } from '$app/paths';
	import { Plus } from '@lucide/svelte';
	import { store } from '#lib/data/index.ts';
	import { ACCOUNT_KIND_LABEL } from '#lib/domain/seed.ts';
	import type { AccountKind, AccountType } from '#lib/domain/types.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { confirmAction, toast } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import { ACCOUNT_KIND_ICON } from '#lib/ui/icons.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';

	const data = useAppData();
	let open = $state(false);
	let editing = $state<AccountType | null>(null);
	let name = $state('');
	let kind = $state<AccountKind>('checking');
	let error = $state('');

	const inUse = (id: string) => data.accounts.filter((a) => a.typeId === id).length;

	function edit(t: AccountType | null) {
		editing = t;
		name = t?.name ?? '';
		kind = t?.kind ?? 'checking';
		error = '';
		open = true;
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) return (error = 'Dê um nome ao tipo.');
		if (editing) await store.accountTypes.update(editing.id, { name: name.trim(), kind });
		else await store.accountTypes.create({ name: name.trim(), kind, isSystem: false });
		toast(editing ? 'Tipo atualizado' : 'Tipo criado');
		open = false;
	}

	async function remove() {
		if (!editing) return;
		const ok = await confirmAction({
			title: 'Excluir tipo?',
			message: `“${editing.name}” será removido.`,
			confirmLabel: 'Excluir',
			destructive: true
		});
		if (!ok) return;
		await store.accountTypes.remove(editing.id);
		toast('Tipo excluído');
		open = false;
	}
</script>

<PageHeader
	title="Tipos de conta"
	back={{ href: resolve('/ajustes'), label: 'Ajustes' }}
	subtitle="A natureza do tipo define como o app trata a conta: cartões guardam dívida, investimentos aparecem separados."
>
	{#snippet actions()}
		<IconButton label="Novo tipo" onclick={() => edit(null)}
			><Plus size={22} strokeWidth={1.6} /></IconButton
		>
	{/snippet}
</PageHeader>

<div class="page">
	<ul>
		{#each data.types as t (t.id)}
			{@const Icon = ACCOUNT_KIND_ICON[t.kind]}
			<li>
				<button type="button" class="row item" onclick={() => edit(t)}>
					<span class="ico"><Icon size={18} strokeWidth={1.6} /></span>
					<span class="main">
						<span>{t.name}</span>
						<small>{ACCOUNT_KIND_LABEL[t.kind]}</small>
					</span>
					<small class="count">{inUse(t.id) || ''}</small>
				</button>
			</li>
		{/each}
	</ul>
</div>

<Sheet bind:open title={editing ? 'Editar tipo' : 'Novo tipo de conta'}>
	<form id="type-form" onsubmit={save} novalidate>
		<label>
			<span class="field-label">Nome</span>
			<input class="input" bind:value={name} placeholder="Ex.: Conta no exterior" />
		</label>
		<label>
			<span class="field-label">Natureza</span>
			<select class="input" bind:value={kind}>
				{#each Object.entries(ACCOUNT_KIND_LABEL) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</label>
		{#if error}<p class="err">{error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="actions">
			{#if editing && !editing.isSystem && !inUse(editing.id)}
				<Button variant="danger" onclick={remove}>Excluir</Button>
			{/if}
			<Button type="submit" form="type-form" size="lg" block>Salvar</Button>
		</div>
	{/snippet}
</Sheet>

<style>
	.page {
		padding-inline: 20px;
	}
	.item {
		width: 100%;
		text-align: left;
	}
	.ico {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--accent-soft);
		color: var(--accent);
	}
	.main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	small {
		font-size: 13px;
		color: var(--ink-2);
	}
	.count {
		color: var(--ink-3);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
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

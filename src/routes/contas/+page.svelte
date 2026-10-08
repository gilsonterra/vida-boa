<script lang="ts">
	import { Pencil, Plus } from '@lucide/svelte';
	import type { Account } from '#lib/domain/types.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { openStatement } from '#lib/stores/ui.svelte.ts';
	import AccountEditor from '#lib/ui/AccountEditor.svelte';
	import AccountTypesSection from '#lib/ui/AccountTypesSection.svelte';
	import Amount from '#lib/ui/Amount.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import { ACCOUNT_KIND_ICON } from '#lib/ui/icons.ts';
	import LoansSection from '#lib/ui/LoansSection.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';

	/** Tudo o que é cadastro de conta numa tela: contas e cartões, financiamentos e tipos. */
	const data = useAppData();
	let editorOpen = $state(false);
	/** Conta em edição; `undefined` cria uma nova. */
	let editing = $state<Account | undefined>(undefined);

	function edit(a: Account | undefined) {
		editing = a;
		editorOpen = true;
	}

	const archived = $derived(data.accounts.filter((a) => a.archived));
</script>

<PageHeader title="Contas">
	{#snippet actions()}
		<IconButton tone="hi" label="Nova conta" onclick={() => edit(undefined)}
			><Plus size={22} strokeWidth={1.6} /></IconButton
		>
	{/snippet}
</PageHeader>

<div class="page">
	{#if data.ready && data.accounts.length === 0}
		<EmptyState
			title="Nenhuma conta"
			text="Cadastre contas correntes, cartões e investimentos para acompanhar o patrimônio."
		>
			<Button onclick={() => edit(undefined)}>Cadastrar conta</Button>
		</EmptyState>
	{/if}

	<h2 class="first">Contas e cartões</h2>

	{#snippet list(accounts: typeof data.accounts)}
		<ul>
			{#each accounts as a (a.id)}
				{@const Icon = ACCOUNT_KIND_ICON[data.kindOf(a.id)]}
				<li class="row acct">
					<!-- Tocar na conta abre o extrato dela; o lápis edita o cadastro. -->
					<button type="button" class="open" onclick={() => openStatement(a.id)}>
						<span class="ico tinted" style:--c={a.color}><Icon size={18} strokeWidth={1.6} /></span>
						<span class="main">
							<span>{a.name}</span>
							<small
								>{data.typeById.get(a.typeId)?.name}{a.institution
									? `, ${a.institution}`
									: ''}</small
							>
						</span>
						<Amount cents={data.balances.get(a.id) ?? 0} size="sm" tone="debt" />
					</button>
					<IconButton label={`Editar ${a.name}`} onclick={() => edit(a)}
						><Pencil size={17} strokeWidth={1.6} /></IconButton
					>
				</li>
			{/each}
		</ul>
	{/snippet}

	{@render list(data.activeAccounts)}

	{#if archived.length}
		<h2>Arquivadas</h2>
		{@render list(archived)}
	{/if}

	<LoansSection />
	<AccountTypesSection />
</div>

<AccountEditor bind:open={editorOpen} account={editing} />

<style>
	.page {
		padding-inline: 20px;
	}
	.ico {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
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
	.acct {
		gap: 6px;
		padding-right: 8px;
	}
	.open {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 14px;
		text-align: left;
		color: inherit;
	}
	h2 {
		margin: 36px 0 6px;
		font-size: 20px;
	}
	h2.first {
		margin-top: 8px;
		margin-bottom: 12px;
	}
</style>

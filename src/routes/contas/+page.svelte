<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronRight, Plus } from '@lucide/svelte';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import AccountEditor from '#lib/ui/AccountEditor.svelte';
	import Amount from '#lib/ui/Amount.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import { ACCOUNT_KIND_ICON } from '#lib/ui/icons.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';

	const data = useAppData();
	let editorOpen = $state(false);

	const archived = $derived(data.accounts.filter((a) => a.archived));
</script>

<PageHeader title="Contas e cartões" back={{ href: resolve('/ajustes'), label: 'Ajustes' }}>
	{#snippet actions()}
		<IconButton tone="hi" label="Nova conta" onclick={() => (editorOpen = true)}
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
			<Button onclick={() => (editorOpen = true)}>Cadastrar conta</Button>
		</EmptyState>
	{/if}

	{#snippet list(accounts: typeof data.accounts)}
		<ul>
			{#each accounts as a (a.id)}
				{@const Icon = ACCOUNT_KIND_ICON[data.kindOf(a.id)]}
				<li>
					<a class="row" href={resolve('/contas/[id]', { id: a.id })}>
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
						<ChevronRight size={16} strokeWidth={1.5} class="chev" />
					</a>
				</li>
			{/each}
		</ul>
	{/snippet}

	{@render list(data.activeAccounts)}

	{#if archived.length}
		<h2>Arquivadas</h2>
		{@render list(archived)}
	{/if}
</div>

<AccountEditor bind:open={editorOpen} />

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
	.row :global(.chev) {
		color: var(--ink-3);
	}
	h2 {
		margin: 36px 0 6px;
		font-size: 20px;
	}
</style>

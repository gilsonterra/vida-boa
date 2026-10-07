<script lang="ts">
	import type { Transaction } from '../domain/types';
	import { useAppData } from '../stores/data.svelte';
	import { openEditor } from '../stores/ui.svelte';
	import Amount from './Amount.svelte';
	import CategoryMark from './CategoryMark.svelte';

	interface Props {
		transaction: Transaction;
		/** Mostra a conta sob o valor (útil no extrato geral). */
		showAccount?: boolean;
	}

	let { transaction: t, showAccount = true }: Props = $props();
	const data = useAppData();

	const category = $derived(t.categoryId ? data.categoryById.get(t.categoryId) : undefined);
	const account = $derived(data.accountById.get(t.accountId));
	const secondary = $derived.by(() => {
		if (t.kind === 'transfer') {
			const partner = data.partnerOf(t);
			const other = partner ? data.accountById.get(partner.accountId)?.name : null;
			if (!other) return 'Transferência sem par';
			return t.amountCents < 0 ? `Para ${other}` : `De ${other}`;
		}
		if (category) return category.name;
		return t.amountCents > 0 && t.kind === 'expense' ? 'Estorno sem categoria' : 'Sem categoria';
	});
</script>

<button type="button" class="row tx" onclick={() => openEditor({ transaction: t })}>
	<CategoryMark {category} transfer={t.kind === 'transfer'} />
	<span class="main">
		<span class="desc">{t.description}</span>
		<span class="sub" class:missing={!category && t.kind !== 'transfer'}>{secondary}</span>
	</span>
	<span class="side">
		<Amount
			cents={t.amountCents}
			size="sm"
			signed={t.kind !== 'transfer'}
			tone={t.kind === 'transfer' ? 'neutral' : 'auto'}
		/>
		{#if showAccount && account}
			<span class="acct"><i style:background={account.color}></i>{account.name}</span>
		{/if}
	</span>
</button>

<style>
	.tx {
		width: 100%;
		text-align: left;
		transition: transform 120ms;
	}
	.tx:active {
		transform: scale(0.985);
	}
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.desc {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	.sub {
		font-size: 13px;
		color: var(--ink-2);
	}
	.sub.missing {
		color: var(--brass);
	}
	.side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 3px;
	}
	.acct {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: var(--ink-3);
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.acct i {
		width: 6px;
		height: 6px;
		border-radius: 99px;
		flex-shrink: 0;
	}
</style>

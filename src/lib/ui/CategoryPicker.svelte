<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import type { Category, CategoryKind, ID } from '../domain/types';
	import { useAppData } from '../stores/data.svelte';
	import CategoryMark from './CategoryMark.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		value: ID | null;
		kind: CategoryKind;
		onchange?: (id: ID | null) => void;
		/** Versão em linha, para listas (prévia de importação). */
		compact?: boolean;
	}

	let { value = $bindable(), kind, onchange, compact = false }: Props = $props();
	const data = useAppData();
	let open = $state(false);

	const options = $derived(kind === 'expense' ? data.expenseCategories : data.incomeCategories);
	const selected = $derived(value ? data.categoryById.get(value) : undefined);

	function pick(c: Category | null) {
		value = c?.id ?? null;
		onchange?.(value);
		open = false;
	}
</script>

{#if compact}
	<button type="button" class="chip" class:empty={!selected} onclick={() => (open = true)}>
		{selected?.name ?? 'Categorizar'}
	</button>
{:else}
	<button type="button" class="input trigger" onclick={() => (open = true)}>
		<CategoryMark category={selected} size={28} />
		<span class="name" class:placeholder={!selected}>{selected?.name ?? 'Escolher categoria'}</span>
		<ChevronRight size={18} strokeWidth={1.5} class="chev" />
	</button>
{/if}

<Sheet bind:open title={kind === 'expense' ? 'Categoria da despesa' : 'Categoria da receita'}>
	<div class="grid">
		{#each options as c (c.id)}
			<button type="button" class="opt" class:on={c.id === value} onclick={() => pick(c)}>
				<CategoryMark category={c} size={44} />
				<span>{c.name}</span>
			</button>
		{/each}
	</div>
	{#if value}
		<button type="button" class="clear" onclick={() => pick(null)}>Remover categoria</button>
	{/if}
</Sheet>

<style>
	.chip {
		font-size: 13px;
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.chip.empty {
		color: var(--brass);
	}
	.trigger {
		display: flex;
		align-items: center;
		gap: 12px;
		text-align: left;
		padding-block: 8px;
	}
	.name {
		flex: 1;
	}
	.placeholder {
		color: var(--ink-3);
	}
	.trigger :global(.chev) {
		color: var(--ink-3);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 6px;
	}
	.opt {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px 4px;
		border-radius: 16px;
		font-size: 12.5px;
		line-height: 1.25;
		text-align: center;
		color: var(--ink-2);
	}
	.opt.on {
		background: var(--accent-soft);
		color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.clear {
		display: block;
		margin: 16px auto 0;
		color: var(--danger);
		font-size: 14px;
	}
</style>

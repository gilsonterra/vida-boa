<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { store } from '#lib/data/index.ts';
	import { PALETTE } from '#lib/domain/seed.ts';
	import type { Category, CategoryKind } from '#lib/domain/types.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { confirmAction, toast } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import CategoryMark from '#lib/ui/CategoryMark.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import { CATEGORY_ICONS } from '#lib/ui/icons.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import RulesSection from '#lib/ui/RulesSection.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';

	const data = useAppData();
	/** Categorias e regras de categorização na mesma tela. */
	let view = $state<'categories' | 'rules'>('categories');
	let rules = $state<ReturnType<typeof RulesSection>>();
	let tab = $state<CategoryKind>('expense');
	let open = $state(false);
	let editing = $state<Category | null>(null);
	let name = $state('');
	let kind = $state<CategoryKind>('expense');
	let icon = $state('circle');
	let color = $state<string>(PALETTE[0]);
	let error = $state('');

	const list = $derived(tab === 'expense' ? data.expenseCategories : data.incomeCategories);
	const usage = $derived.by(() => {
		const m = new Map<string, number>();
		for (const t of data.transactions)
			if (t.categoryId) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1);
		return m;
	});

	function edit(c: Category | null) {
		editing = c;
		name = c?.name ?? '';
		kind = c?.kind ?? tab;
		icon = c?.icon ?? 'circle';
		color = c?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)];
		error = '';
		open = true;
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) return (error = 'Dê um nome à categoria.');
		const fields = { name: name.trim(), kind, icon, color };
		if (editing) await store.categories.update(editing.id, fields);
		else await store.categories.create({ ...fields, isSystem: false });
		toast(editing ? 'Categoria atualizada' : 'Categoria criada');
		open = false;
	}

	async function remove() {
		if (!editing) return;
		const count = usage.get(editing.id) ?? 0;
		const rules = data.rules.filter((r) => r.categoryId === editing!.id);
		const ok = await confirmAction({
			title: 'Excluir categoria?',
			message: count
				? `${count} lançamento(s) ficarão sem categoria${rules.length ? ` e ${rules.length} regra(s) serão removidas` : ''}.`
				: `“${editing.name}” será removida.`,
			confirmLabel: 'Excluir',
			destructive: true
		});
		if (!ok) return;
		const ids = data.transactions.filter((t) => t.categoryId === editing!.id).map((t) => t.id);
		if (ids.length) await store.transactions.setCategory(ids, null);
		for (const r of rules) await store.rules.remove(r.id);
		await store.categories.remove(editing.id);
		toast('Categoria excluída');
		open = false;
	}
</script>

<PageHeader title="Categorias">
	{#snippet actions()}
		{#if view === 'categories'}
			<IconButton tone="hi" label="Nova categoria" onclick={() => edit(null)}
				><Plus size={22} strokeWidth={1.6} /></IconButton
			>
		{:else}
			<IconButton tone="hi" label="Nova regra" onclick={() => rules?.newRule()}
				><Plus size={22} strokeWidth={1.6} /></IconButton
			>
		{/if}
	{/snippet}
</PageHeader>

<div class="page">
	<div class="views">
		<Segmented
			label="Mostrar"
			bind:value={view}
			options={[
				{ value: 'categories', label: 'Categorias' },
				{ value: 'rules', label: `Regras (${data.rules.filter((r) => !r.isSystem).length})` }
			]}
		/>
	</div>

	{#if view === 'categories'}
		<Segmented
			label="Tipo de categoria"
			bind:value={tab}
			options={[
				{ value: 'expense', label: 'Despesas' },
				{ value: 'income', label: 'Receitas' }
			]}
		/>
		<ul class="list">
			{#each list as c (c.id)}
				<li>
					<button type="button" class="row item" onclick={() => edit(c)}>
						<CategoryMark category={c} />
						<span class="grow">{c.name}</span>
						<small>{usage.get(c.id) ?? ''}</small>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<RulesSection bind:this={rules} />
	{/if}
</div>

<Sheet bind:open title={editing ? 'Editar categoria' : 'Nova categoria'}>
	<form id="cat-form" onsubmit={save} novalidate>
		<div class="preview">
			<CategoryMark
				category={{ ...(editing ?? ({} as Category)), name, kind, icon, color }}
				size={56}
			/>
		</div>
		<label>
			<span class="field-label">Nome</span>
			<input class="input" bind:value={name} placeholder="Ex.: Vinhos" />
		</label>
		<Segmented
			label="Natureza"
			bind:value={kind}
			options={[
				{ value: 'expense', label: 'Despesa' },
				{ value: 'income', label: 'Receita' }
			]}
		/>
		<fieldset>
			<legend class="field-label">Ícone</legend>
			<div class="icons">
				{#each Object.entries(CATEGORY_ICONS) as [key, Icon] (key)}
					<button
						type="button"
						class="icon"
						class:on={icon === key}
						aria-label={key}
						aria-pressed={icon === key}
						onclick={() => (icon = key)}
					>
						<Icon size={20} strokeWidth={1.6} />
					</button>
				{/each}
			</div>
		</fieldset>
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
		{#if error}<p class="err">{error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="actions">
			{#if editing}<Button variant="danger" onclick={remove}>Excluir</Button>{/if}
			<Button type="submit" form="cat-form" size="lg" block>Salvar</Button>
		</div>
	{/snippet}
</Sheet>

<style>
	.page {
		padding-inline: 20px;
	}
	.views {
		margin-bottom: 18px;
	}
	.list {
		margin-top: 16px;
	}
	.item {
		width: 100%;
		text-align: left;
	}
	.grow {
		flex: 1;
	}
	small {
		color: var(--ink-3);
		font-size: 13px;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.preview {
		display: flex;
		justify-content: center;
		padding-top: 4px;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.icons {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
		gap: 6px;
	}
	.icon {
		display: grid;
		place-items: center;
		height: 44px;
		border-radius: 12px;
		color: var(--ink-2);
	}
	.icon.on {
		background: var(--accent-soft);
		color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
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
	}
	.swatch.on {
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 4px var(--ink);
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

<script lang="ts">
	import { resolve } from '$app/paths';
	import { Plus } from '@lucide/svelte';
	import { store } from '#lib/data/index.ts';
	import { today } from '#lib/domain/dates.ts';
	import { findMatchingRule } from '#lib/domain/rules.ts';
	import { buildRulesFile, parseRulesFile, planRulesImport } from '#lib/domain/rules-file.ts';
	import type { CategorizationRule, CategoryKind, ID, MatchType } from '#lib/domain/types.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { confirmAction, toast } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import CategoryMark from '#lib/ui/CategoryMark.svelte';
	import CategoryPicker from '#lib/ui/CategoryPicker.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';

	const data = useAppData();
	const MATCH_LABEL: Record<MatchType, string> = {
		contains: 'contém',
		starts_with: 'começa com',
		equals: 'é igual a'
	};

	let open = $state(false);
	let editing = $state<CategorizationRule | null>(null);
	let pattern = $state('');
	let matchType = $state<MatchType>('contains');
	let kind = $state<CategoryKind>('expense');
	let categoryId = $state<ID | null>(null);
	let accountId = $state<ID>('');
	let error = $state('');
	let query = $state('');

	const mine = $derived(
		data.rules.filter((r) => !r.isSystem).sort((a, b) => a.pattern.localeCompare(b.pattern))
	);
	const builtIn = $derived(
		data.rules
			.filter(
				(r) => r.isSystem && (!query || r.pattern.toLowerCase().includes(query.toLowerCase()))
			)
			.sort((a, b) => a.pattern.localeCompare(b.pattern))
	);
	const uncategorized = $derived(
		data.transactions.filter((t) => !t.categoryId && t.kind !== 'transfer')
	);

	function edit(r: CategorizationRule | null) {
		editing = r;
		pattern = r?.pattern ?? '';
		matchType = r?.matchType ?? 'contains';
		categoryId = r?.categoryId ?? null;
		kind = (r && data.categoryById.get(r.categoryId)?.kind) || 'expense';
		accountId = r?.accountId ?? '';
		error = '';
		open = true;
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!pattern.trim()) return (error = 'Informe o texto a procurar na descrição.');
		if (!categoryId) return (error = 'Escolha a categoria.');
		const fields = { pattern: pattern.trim(), matchType, categoryId, accountId: accountId || null };
		if (editing) await store.rules.update(editing.id, fields);
		else await store.rules.create({ ...fields, priority: 10, isSystem: false });
		toast(editing ? 'Regra atualizada' : 'Regra criada');
		open = false;
	}

	async function remove() {
		if (!editing) return;
		const ok = await confirmAction({
			title: 'Excluir regra?',
			message: 'Os lançamentos já categorizados não mudam.',
			confirmLabel: 'Excluir',
			destructive: true
		});
		if (!ok) return;
		await store.rules.remove(editing.id);
		toast('Regra excluída');
		open = false;
	}

	async function importRules(file: File) {
		let parsed;
		try {
			parsed = parseRulesFile(JSON.parse(await file.text()));
		} catch (err) {
			return toast(
				err instanceof SyntaxError ? 'O arquivo não é um JSON válido.' : (err as Error).message
			);
		}
		const plan = planRulesImport(parsed, data.rules, data.categories);
		for (const r of plan.create) {
			await store.rules.create({ ...r, accountId: null, priority: 10, isSystem: false });
		}
		const parts = [`${plan.create.length} regra(s) importada(s)`];
		if (plan.duplicates) parts.push(`${plan.duplicates} já existiam`);
		if (plan.unknownCategories.length)
			parts.push(`categorias não encontradas: ${plan.unknownCategories.join(', ')}`);
		toast(
			parts.join('; '),
			plan.create.length && uncategorized.length
				? { label: 'Aplicar agora', run: applyNow }
				: undefined
		);
	}

	function exportRules() {
		const file = buildRulesFile(data.rules, data.categories);
		if (!file.rules.length) return toast('Você ainda não tem regras próprias para exportar.');
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
		);
		const a = document.createElement('a');
		a.href = url;
		a.download = `vida-boa-regras-${today()}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast(`${file.rules.length} regra(s) exportada(s)`);
	}

	/** Passa as regras nos lançamentos que ainda estão sem categoria. */
	async function applyNow() {
		const updates = new Map<ID, ID[]>();
		for (const t of uncategorized) {
			const rule = findMatchingRule(data.rules, t.description, t.accountId);
			const cat = rule && data.categoryById.get(rule.categoryId);
			if (!cat) continue;
			// Saída nunca recebe categoria de receita.
			if (t.amountCents < 0 && cat.kind === 'income') continue;
			updates.set(cat.id, [...(updates.get(cat.id) ?? []), t.id]);
		}
		let total = 0;
		for (const [cat, ids] of updates) {
			await store.transactions.setCategory(ids, cat);
			total += ids.length;
		}
		toast(
			total
				? `${total} lançamento(s) categorizados`
				: 'Nenhuma regra casou com os lançamentos sem categoria'
		);
	}
</script>

<PageHeader
	title="Regras"
	back={{ href: resolve('/ajustes'), label: 'Ajustes' }}
	subtitle="Quando a descrição de um lançamento casa com uma regra, ele já chega categorizado na importação."
>
	{#snippet actions()}
		<IconButton tone="hi" label="Nova regra" onclick={() => edit(null)}
			><Plus size={22} strokeWidth={1.6} /></IconButton
		>
	{/snippet}
</PageHeader>

<div class="page">
	{#if uncategorized.length}
		<div class="apply">
			<p>{uncategorized.length} lançamento(s) sem categoria.</p>
			<Button size="sm" variant="secondary" onclick={applyNow}>Aplicar regras agora</Button>
		</div>
	{/if}

	{#snippet item(r: CategorizationRule)}
		{@const c = data.categoryById.get(r.categoryId)}
		<li>
			<button type="button" class="row rule" onclick={() => edit(r)}>
				<CategoryMark category={c} size={34} />
				<span class="main">
					<span
						><span class="muted">{MATCH_LABEL[r.matchType]}</span>
						<strong>{r.pattern}</strong></span
					>
					<small
						>{c?.name ?? 'Categoria removida'}{r.accountId
							? `, só em ${data.accountById.get(r.accountId)?.name ?? 'conta removida'}`
							: ''}</small
					>
				</span>
			</button>
		</li>
	{/snippet}

	<h2>Suas regras</h2>
	{#if mine.length}
		<ul>
			{#each mine as r (r.id)}{@render item(r)}{/each}
		</ul>
	{:else}
		<p class="muted">
			Ao mudar a categoria de um lançamento, o app oferece criar uma regra. Você também pode criar
			aqui, pelo botão +.
		</p>
	{/if}

	<h2>Suas regras em arquivo</h2>
	<p class="muted">
		Leve suas regras para outro aparelho ou importe uma lista pronta (JSON). Regras repetidas são
		ignoradas.
	</p>
	<div class="file-actions">
		<label class="file-btn">
			Importar regras
			<input
				type="file"
				accept="application/json,.json"
				class="sr-only"
				onchange={(e) => {
					const f = e.currentTarget.files?.[0];
					if (f) importRules(f);
					e.currentTarget.value = '';
				}}
			/>
		</label>
		<Button variant="secondary" onclick={exportRules}>Exportar minhas regras</Button>
	</div>

	<h2>Regras prontas</h2>
	<input
		class="input filter"
		type="search"
		placeholder="Filtrar regras prontas"
		bind:value={query}
	/>
	<ul>
		{#each builtIn as r (r.id)}{@render item(r)}{/each}
	</ul>
</div>

<Sheet bind:open title={editing ? 'Editar regra' : 'Nova regra'}>
	<form id="rule-form" onsubmit={save} novalidate>
		<div class="two">
			<label>
				<span class="field-label">Quando a descrição</span>
				<select class="input" bind:value={matchType}>
					<option value="contains">contém</option>
					<option value="starts_with">começa com</option>
					<option value="equals">é igual a</option>
				</select>
			</label>
			<label>
				<span class="field-label">Texto</span>
				<input class="input" bind:value={pattern} placeholder="Ex.: FASANO" autocomplete="off" />
			</label>
		</div>
		<Segmented
			label="Natureza"
			bind:value={kind}
			onchange={() => (categoryId = null)}
			options={[
				{ value: 'expense', label: 'Despesa' },
				{ value: 'income', label: 'Receita' }
			]}
		/>
		<div>
			<span class="field-label">Categoria</span>
			<CategoryPicker bind:value={categoryId} {kind} />
		</div>
		<label>
			<span class="field-label">Vale para</span>
			<select class="input" bind:value={accountId}>
				<option value="">Todas as contas</option>
				{#each data.activeAccounts as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
			</select>
		</label>
		<p class="hint">Maiúsculas e acentos são ignorados na comparação.</p>
		{#if error}<p class="err">{error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="actions">
			{#if editing}<Button variant="danger" onclick={remove}>Excluir</Button>{/if}
			<Button type="submit" form="rule-form" size="lg" block>Salvar regra</Button>
		</div>
	{/snippet}
</Sheet>

<style>
	.page {
		padding-inline: 20px;
	}
	.apply {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 16px;
		border-radius: 16px;
		background: var(--sunken);
		font-size: 14px;
	}
	h2 {
		margin: 32px 0 6px;
		font-size: 20px;
	}
	.rule {
		width: 100%;
		text-align: left;
	}
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	strong {
		font-weight: 550;
		letter-spacing: 0.01em;
	}
	small {
		font-size: 13px;
		color: var(--ink-2);
	}
	.muted {
		color: var(--ink-2);
	}
	.file-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 12px;
	}
	.file-btn {
		display: inline-flex;
		align-items: center;
		height: 44px;
		padding: 0 20px;
		border-radius: 999px;
		box-shadow: inset 0 0 0 1px var(--rule-strong);
		font-weight: 500;
		cursor: pointer;
	}
	.file-btn:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.filter {
		margin: 6px 0 4px;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1.4fr;
		gap: 12px;
	}
	.hint {
		font-size: 13px;
		color: var(--ink-3);
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

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Check, FileUp } from '@lucide/svelte';
	import { store } from '#lib/data/index.ts';
	import { formatDayShort } from '#lib/domain/dates.ts';
	import { formatCents } from '#lib/domain/money.ts';
	import { balanceAt } from '#lib/domain/reports.ts';
	import type { Account, ID, ImportBatch } from '#lib/domain/types.ts';
	import { buildImportPlan, planSummary, type ImportItem } from '#lib/import/plan.ts';
	import { decodeOfx, OfxParseError, parseOfx, type OfxStatement } from '#lib/ofx/parse.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { confirmAction, haptic, toast } from '#lib/stores/ui.svelte.ts';
	import AccountEditor from '#lib/ui/AccountEditor.svelte';
	import Amount from '#lib/ui/Amount.svelte';
	import Button from '#lib/ui/Button.svelte';
	import CategoryPicker from '#lib/ui/CategoryPicker.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';

	const data = useAppData();

	type Step = 'pick' | 'review' | 'done';
	let step = $state<Step>('pick');
	let fileName = $state('');
	let statements = $state<OfxStatement[]>([]);
	let statementIndex = $state(0);
	let warnings = $state<string[]>([]);
	let accountId = $state<ID>('');
	let items = $state<ImportItem[]>([]);
	let parseError = $state('');
	let dragging = $state(false);
	let busy = $state(false);
	let newAccountOpen = $state(false);
	let result = $state<{
		imported: number;
		skipped: number;
		account: Account;
		balanceDiff: number | null;
	} | null>(null);
	let showSkipped = $state(false);

	const statement = $derived(statements[statementIndex]);
	const summary = $derived(planSummary(items));
	const account = $derived(data.accountById.get(accountId));

	async function readFile(file: File) {
		parseError = '';
		try {
			const text = decodeOfx(new Uint8Array(await file.arrayBuffer()));
			const doc = parseOfx(text);
			fileName = file.name;
			statements = doc.statements;
			warnings = doc.warnings;
			statementIndex = 0;
			accountId = guessAccount(doc.statements[0]);
			step = 'review';
			await replan();
		} catch (err) {
			parseError =
				err instanceof OfxParseError
					? err.message
					: 'Não foi possível ler este arquivo. Exporte de novo no formato OFX e tente outra vez.';
		}
	}

	/** Casa o extrato com uma conta: primeiro pelo ACCTID salvo, depois pelo tipo. */
	function guessAccount(s: OfxStatement): ID {
		const byId = data.accounts.find((a) => a.ofxAccountId && a.ofxAccountId === s.accountId);
		if (byId) return byId.id;
		const wanted = s.kind === 'credit_card' ? 'credit_card' : 'checking';
		const sameKind = data.activeAccounts.filter(
			(a) => data.kindOf(a.id) === wanted && !a.ofxAccountId
		);
		return sameKind.length === 1 ? sameKind[0].id : '';
	}

	async function replan() {
		if (!statement || !accountId) {
			items = [];
			return;
		}
		const [existing, rules, categories] = await Promise.all([
			store.transactions.listByAccount(accountId, { includeDeleted: true }),
			store.rules.list(),
			store.categories.list()
		]);
		items = buildImportPlan(statement.transactions, {
			accountId,
			accountKind: data.kindOf(accountId),
			existing,
			others: data.transactions.filter((t) => t.accountId !== accountId),
			accountKinds: new Map(data.accounts.map((a) => [a.id, data.kindOf(a.id)])),
			history: data.transactions,
			rules,
			categories
		});
	}

	async function commit() {
		if (!statement || !account || busy) return;
		busy = true;
		try {
			const batch = await store.imports.commit({
				accountId,
				fileName,
				statement,
				items: $state.snapshot(items)
			});
			// Confere o saldo calculado com o informado pelo banco.
			let balanceDiff: number | null = null;
			if (statement.ledgerBalanceCents !== null && statement.ledgerDate) {
				const txs = await store.transactions.listByAccount(accountId);
				const fresh = (await store.accounts.get(accountId))!;
				balanceDiff = statement.ledgerBalanceCents - balanceAt(fresh, txs, statement.ledgerDate);
			}
			result = { imported: batch.importedCount, skipped: batch.skippedCount, account, balanceDiff };
			step = 'done';
			haptic(12);
		} catch (err) {
			toast((err as Error).message || 'Falha ao importar.');
		} finally {
			busy = false;
		}
	}

	async function fixBalance() {
		if (!result?.balanceDiff) return;
		const acc = (await store.accounts.get(result.account.id))!;
		await store.accounts.update(acc.id, {
			initialBalanceCents: acc.initialBalanceCents + result.balanceDiff
		});
		result = { ...result, balanceDiff: 0 };
		toast('Saldo ajustado ao do banco');
	}

	function ondrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const file = e.dataTransfer?.files[0];
		if (file) readFile(file);
	}

	function reset() {
		step = 'pick';
		statements = [];
		items = [];
		result = null;
		fileName = '';
	}

	const statusLabel = {
		new: 'Novo',
		duplicate: 'Já existe',
		possible_duplicate: 'Talvez repetido'
	} as const;
	const visibleItems = $derived(
		showSkipped ? items : items.filter((i) => i.status === 'new' || i.include)
	);
	const hiddenCount = $derived(items.length - visibleItems.length);

	const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

	async function undoImport(b: ImportBatch) {
		const ok = await confirmAction({
			title: 'Desfazer importação?',
			message: `Os ${b.importedCount} lançamentos de “${b.fileName}” serão removidos, inclusive os que você editou depois.`,
			confirmLabel: 'Desfazer',
			destructive: true
		});
		if (!ok) return;
		const n = await store.imports.undo(b.id);
		toast(`${n} lançamento(s) removidos`);
	}
</script>

<PageHeader
	title="Importar extrato"
	back={{ href: resolve('/'), label: 'Início' }}
	subtitle={step === 'pick'
		? 'Use o arquivo OFX exportado pelo internet banking do seu banco ou do cartão.'
		: undefined}
/>

<div class="page">
	{#if step === 'pick'}
		<label
			class="drop"
			class:dragging
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			{ondrop}
		>
			<FileUp size={28} strokeWidth={1.3} />
			<strong>Escolher arquivo OFX</strong>
			<span>ou arraste o arquivo para cá</span>
			<input
				type="file"
				accept=".ofx,.qfx,application/x-ofx,application/vnd.intu.qfx"
				class="sr-only"
				onchange={(e) => {
					const f = e.currentTarget.files?.[0];
					if (f) readFile(f);
					e.currentTarget.value = '';
				}}
			/>
		</label>
		{#if parseError}<p class="error" role="alert">{parseError}</p>{/if}

		<div class="help">
			<h2>Como funciona</h2>
			<ul>
				<li>
					Lançamentos que já existem são reconhecidos e ficam de fora, mesmo se você importar o
					mesmo período duas vezes.
				</li>
				<li>As categorias são sugeridas pelas suas regras e pelo que você já categorizou antes.</li>
				<li>
					Pagamentos de fatura viram transferência entre a conta e o cartão, sem contar como gasto
					em dobro.
				</li>
				<li>O arquivo é lido aqui mesmo, no aparelho. Nada é enviado para servidores.</li>
			</ul>
		</div>
	{:else if step === 'review' && statement}
		<section class="file">
			<p class="fname">{fileName}</p>
			<p class="meta">
				{statement.kind === 'credit_card' ? 'Fatura de cartão' : 'Extrato bancário'}
				{#if statement.start && statement.end}de {formatDayShort(statement.start)} a {formatDayShort(
						statement.end
					)}{/if}
				{#if statement.accountId}, conta {statement.accountId}{/if}
			</p>
			{#if statements.length > 1}
				<select
					class="input"
					bind:value={statementIndex}
					onchange={() => {
						accountId = guessAccount(statement);
						replan();
					}}
				>
					{#each statements as s, i (i)}
						<option value={i}
							>Extrato {i + 1}: {s.accountId ?? 'conta'} ({s.transactions.length} lançamentos)</option
						>
					{/each}
				</select>
			{/if}
		</section>

		<label class="acct">
			<span class="field-label">Importar para a conta</span>
			<div class="acct-row">
				<select class="input" bind:value={accountId} onchange={replan}>
					<option value="" disabled>Escolher conta</option>
					{#each data.activeAccounts as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
				</select>
				<Button variant="secondary" onclick={() => (newAccountOpen = true)}>Nova conta</Button>
			</div>
		</label>

		{#if accountId}
			<dl class="stats">
				<div>
					<dt>No arquivo</dt>
					<dd class="figures">{summary.total}</dd>
				</div>
				<div>
					<dt>Novos</dt>
					<dd class="figures">{summary.toImport}</dd>
				</div>
				<div>
					<dt>Já existentes</dt>
					<dd class="figures">{summary.duplicates}</dd>
				</div>
				{#if summary.possible}<div>
						<dt>Para revisar</dt>
						<dd class="figures brass">{summary.possible}</dd>
					</div>{/if}
			</dl>

			{#if warnings.length}
				<p class="warn">
					{warnings.length} linha(s) do arquivo foram ignoradas por estarem incompletas.
				</p>
			{/if}

			<ul class="items">
				{#each visibleItems as item (item.index)}
					<li class="row item" class:off={!item.include}>
						<input
							type="checkbox"
							bind:checked={item.include}
							aria-label="Importar {item.description}"
						/>
						<div class="main">
							<span class="desc">{item.description}</span>
							<span class="sub">
								<span>{formatDayShort(item.source.date)}</span>
								{#if item.status !== 'new'}
									<span class="badge {item.status}" title={item.reason ?? ''}
										>{statusLabel[item.status]}</span
									>
								{/if}
								{#if item.include}
									{#if item.kind === 'transfer'}
										<span class="transfer"
											>{item.pairWithId ? 'Transferência pareada' : 'Transferência'}</span
										>
									{:else}
										<CategoryPicker
											compact
											bind:value={item.categoryId}
											kind={item.kind === 'income' ? 'income' : 'expense'}
										/>
									{/if}
								{/if}
							</span>
							{#if item.reason && item.status !== 'new'}<span class="reason">{item.reason}</span
								>{/if}
						</div>
						<Amount
							cents={item.source.amountCents}
							size="sm"
							signed
							tone={item.kind === 'transfer' ? 'neutral' : 'auto'}
						/>
					</li>
				{/each}
			</ul>
			{#if hiddenCount > 0 || showSkipped}
				<button type="button" class="toggle" onclick={() => (showSkipped = !showSkipped)}>
					{showSkipped ? 'Ocultar os que já existem' : `Mostrar ${hiddenCount} que já existem`}
				</button>
			{/if}

			<div class="bar pb-safe">
				<Button variant="secondary" onclick={reset}>Cancelar</Button>
				<Button size="lg" block disabled={!summary.toImport || busy} onclick={commit}>
					{summary.toImport
						? `Importar ${summary.toImport} lançamento${summary.toImport > 1 ? 's' : ''}`
						: 'Nada novo para importar'}
				</Button>
			</div>
		{/if}
	{:else if step === 'done' && result}
		<section class="done">
			<span class="seal"><Check size={28} strokeWidth={1.6} /></span>
			<h2>
				{result.imported} lançamento{result.imported === 1 ? '' : 's'} em {result.account.name}
			</h2>
			<p>
				{result.skipped
					? `${result.skipped} ficaram de fora por já existirem ou por sua escolha.`
					: 'Nenhum lançamento repetido.'}
			</p>

			{#if result.balanceDiff}
				<div class="balance">
					<p>
						O saldo informado pelo banco difere do calculado em <strong
							>{formatCents(result.balanceDiff)}</strong
						>. Isso costuma acontecer quando a conta tem movimentações anteriores ao primeiro
						extrato importado.
					</p>
					<Button variant="secondary" onclick={fixBalance}>Ajustar saldo inicial</Button>
				</div>
			{/if}

			<div class="cta">
				<Button size="lg" onclick={() => goto(resolve('/extrato'))}>Ver extrato</Button>
				<Button size="lg" variant="secondary" onclick={reset}>Importar outro arquivo</Button>
			</div>
		</section>
	{/if}

	<!-- Histórico fica aqui mesmo, com a opção de desfazer (fora da revisão, para não distrair). -->
	{#if step !== 'review' && data.imports.length}
		<section class="history">
			<h2>Importações anteriores</h2>
			<ul>
				{#each data.imports as b (b.id)}
					<li class="row item">
						<div class="h-main">
							<span class="h-name">{b.fileName}</span>
							<small>
								{data.accountById.get(b.accountId)?.name ?? 'Conta removida'}, {b.importedCount} importado(s)
								{#if b.periodStart && b.periodEnd}de {formatDayShort(b.periodStart)} a {formatDayShort(
										b.periodEnd
									)}{/if}
							</small>
							<small class="h-when">{when.format(new Date(b.createdAt))}</small>
						</div>
						<Button size="sm" variant="secondary" onclick={() => undoImport(b)}>Desfazer</Button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<AccountEditor
	bind:open={newAccountOpen}
	onsaved={(a) => {
		accountId = a.id;
		replan();
	}}
/>

<style>
	.page {
		padding-inline: 20px;
	}
	.history {
		margin-top: 40px;
	}
	.history h2 {
		margin-bottom: 12px;
		font-size: 17px;
	}
	.h-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.h-name {
		overflow-wrap: anywhere;
	}
	.h-main small {
		font-size: 13px;
		color: var(--ink-2);
	}
	.h-main .h-when {
		color: var(--ink-3);
	}
	.drop {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 44px 20px;
		border: 1.5px dashed var(--rule-strong);
		border-radius: 24px;
		text-align: center;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			border-color 140ms,
			background-color 140ms;
	}
	.drop:hover,
	.drop.dragging {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.drop :global(svg) {
		color: var(--accent);
		margin-bottom: 6px;
	}
	.drop strong {
		color: var(--ink);
		font-weight: 500;
		font-size: 16px;
	}
	.drop span {
		font-size: 14px;
	}
	.drop:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.error {
		margin-top: 14px;
		color: var(--danger);
	}
	.help {
		margin-top: 36px;
	}
	.help h2 {
		font-size: 20px;
		margin-bottom: 10px;
	}
	.help ul {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-left: 18px;
		list-style: disc;
		color: var(--ink-2);
		max-width: 60ch;
	}
	.file .fname {
		font-family: var(--font-display);
		font-size: 20px;
		word-break: break-all;
	}
	.file .meta {
		margin: 4px 0 12px;
		color: var(--ink-2);
		font-size: 14px;
	}
	.acct {
		display: block;
		margin-top: 16px;
	}
	.acct-row {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
		margin: 24px 0 6px;
		padding: 14px 0;
		border-block: 1px solid var(--rule);
	}
	.stats dt {
		font-size: 12px;
		color: var(--ink-2);
	}
	.stats dd {
		margin: 0;
		font-size: 24px;
		font-weight: 350;
	}
	.brass {
		color: var(--brass);
	}
	.warn {
		font-size: 13px;
		color: var(--brass);
		margin: 8px 0;
	}
	.items {
		margin-top: 6px;
	}
	.item {
		align-items: flex-start;
	}
	.item input {
		margin-top: 4px;
		width: 20px;
		height: 20px;
		accent-color: var(--accent);
		flex-shrink: 0;
	}
	.item.off .desc,
	.item.off :global(.amount) {
		opacity: 0.45;
	}
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.desc {
		font-weight: 450;
		overflow-wrap: anywhere;
	}
	.sub {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		font-size: 13px;
		color: var(--ink-3);
	}
	.badge {
		padding: 1px 8px;
		border-radius: 99px;
		font-size: 12px;
		background: var(--sunken);
		color: var(--ink-2);
	}
	.badge.possible_duplicate {
		background: color-mix(in oklab, var(--brass) 16%, transparent);
		color: var(--brass);
	}
	.transfer {
		color: var(--ink-2);
	}
	.reason {
		font-size: 12.5px;
		color: var(--ink-3);
	}
	.toggle {
		margin: 14px 0;
		font-size: 14px;
		color: var(--accent);
	}
	.bar {
		position: sticky;
		bottom: calc(68px + env(safe-area-inset-bottom));
		display: flex;
		gap: 10px;
		margin: 16px -20px 0;
		padding: 12px 20px;
		background: color-mix(in oklab, var(--paper) 90%, transparent);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border-top: 1px solid var(--rule);
	}
	@media (min-width: 900px) {
		.bar {
			bottom: 0;
		}
	}
	.done {
		padding: 24px 0;
	}
	.seal {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: 99px;
		background: var(--accent);
		color: var(--on-accent);
	}
	.done h2 {
		margin-top: 22px;
		font-size: 30px;
		font-weight: 350;
		max-width: 18ch;
	}
	.done > p {
		margin-top: 8px;
		color: var(--ink-2);
	}
	.balance {
		margin-top: 24px;
		padding: 16px;
		border-radius: 16px;
		background: var(--sunken);
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
		font-size: 14px;
		color: var(--ink-2);
	}
	.balance strong {
		color: var(--ink);
	}
	.cta {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 32px;
		max-width: 360px;
	}
</style>

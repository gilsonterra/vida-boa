<script lang="ts">
	import { resolve } from '$app/paths';
	import { store } from '#lib/data/index.ts';
	import { formatDayShort } from '#lib/domain/dates.ts';
	import type { ImportBatch } from '#lib/domain/types.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { confirmAction, toast } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';

	const data = useAppData();
	const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

	async function undo(b: ImportBatch) {
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

<PageHeader title="Importações" back={{ href: resolve('/ajustes'), label: 'Ajustes' }} />

<div class="page">
	{#if data.imports.length}
		<ul>
			{#each data.imports as b (b.id)}
				<li class="row item">
					<div class="main">
						<span class="name">{b.fileName}</span>
						<small>
							{data.accountById.get(b.accountId)?.name ?? 'Conta removida'}, {b.importedCount} importado(s)
							{#if b.periodStart && b.periodEnd}de {formatDayShort(b.periodStart)} a {formatDayShort(
									b.periodEnd
								)}{/if}
						</small>
						<small class="when">{when.format(new Date(b.createdAt))}</small>
					</div>
					<Button size="sm" variant="secondary" onclick={() => undo(b)}>Desfazer</Button>
				</li>
			{/each}
		</ul>
	{:else if data.ready}
		<EmptyState
			title="Nenhuma importação"
			text="Os arquivos OFX importados aparecem aqui, com a opção de desfazer."
		>
			<Button href={resolve('/importar')}>Importar extrato</Button>
		</EmptyState>
	{/if}
</div>

<style>
	.page {
		padding-inline: 20px;
	}
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		overflow-wrap: anywhere;
	}
	small {
		font-size: 13px;
		color: var(--ink-2);
	}
	.when {
		color: var(--ink-3);
	}
</style>

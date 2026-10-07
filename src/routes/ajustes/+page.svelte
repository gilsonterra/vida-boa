<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronRight } from '@lucide/svelte';
	import { store } from '#lib/data/index.ts';
	import { loadDemoData } from '#lib/data/demo.ts';
	import type { Backup } from '#lib/data/repositories.ts';
	import { today } from '#lib/domain/dates.ts';
	import { useAppData } from '#lib/stores/data.svelte.ts';
	import { install, promptInstall } from '#lib/stores/install.svelte.ts';
	import { setTheme, theme, type ThemePref } from '#lib/stores/theme.svelte.ts';
	import { confirmAction, toast } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import CloudAccount from '#lib/ui/CloudAccount.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import PalettePicker from '#lib/ui/PalettePicker.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';

	const data = useAppData();
	let busy = $state(false);

	const links = $derived([
		{ href: resolve('/contas'), label: 'Contas e cartões', count: data.activeAccounts.length },
		{ href: resolve('/tipos-de-conta'), label: 'Tipos de conta', count: data.types.length },
		{ href: resolve('/categorias'), label: 'Categorias', count: data.categories.length },
		{ href: resolve('/regras'), label: 'Regras de categorização', count: data.rules.length },
		{
			href: resolve('/recorrentes'),
			label: 'Lançamentos recorrentes',
			count: data.recurring.length
		},
		{ href: resolve('/importacoes'), label: 'Histórico de importações', count: data.imports.length }
	]);

	async function exportBackup() {
		const backup = await store.exportBackup();
		const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `vida-boa-backup-${today()}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast('Backup salvo');
	}

	async function restore(file: File) {
		let backup: Backup;
		try {
			backup = JSON.parse(await file.text());
		} catch {
			return toast('Este arquivo não é um backup do Vida Boa.');
		}
		const ok = await confirmAction({
			title: 'Restaurar backup?',
			message: 'Todos os dados atuais deste aparelho serão substituídos pelos do arquivo.',
			confirmLabel: 'Restaurar',
			destructive: true
		});
		if (!ok) return;
		try {
			await store.restoreBackup(backup);
			toast('Backup restaurado');
		} catch (err) {
			toast((err as Error).message);
		}
	}

	async function demo() {
		busy = true;
		try {
			await loadDemoData(store);
			toast('Dados de demonstração carregados');
		} finally {
			busy = false;
		}
	}

	async function wipe() {
		const ok = await confirmAction({
			title: 'Apagar todos os dados?',
			message:
				'Contas, lançamentos, regras e importações deste aparelho serão apagados. Faça um backup antes se quiser guardar algo.',
			confirmLabel: 'Apagar tudo',
			destructive: true
		});
		if (!ok) return;
		await store.wipe();
		toast('Dados apagados');
	}
</script>

<PageHeader title="Ajustes" />

<div class="page">
	<CloudAccount />

	<section>
		<h2>Cadastros</h2>
		<ul>
			{#each links as l (l.href)}
				<li>
					<a class="row link" href={l.href}>
						<span class="grow">{l.label}</span>
						<span class="count tabular">{l.count}</span>
						<ChevronRight size={16} strokeWidth={1.5} />
					</a>
				</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2>Aparência</h2>
		<h3>Paleta</h3>
		<PalettePicker />
		<h3>Modo</h3>
		<Segmented
			label="Tema"
			bind:value={() => theme.pref, (v: ThemePref) => setTheme(v)}
			options={[
				{ value: 'system', label: 'Automático' },
				{ value: 'light', label: 'Claro' },
				{ value: 'dark', label: 'Escuro' }
			]}
		/>
	</section>

	{#if !install.installed}
		<section>
			<h2>Instalar no aparelho</h2>
			{#if install.available}
				<p class="text">Abre como um aplicativo, em tela cheia, e funciona sem internet.</p>
				<Button onclick={promptInstall}>Instalar Vida Boa</Button>
			{:else if install.ios}
				<p class="text">
					No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.
				</p>
			{:else}
				<p class="text">
					Use a opção “Instalar app” ou “Adicionar à tela inicial” no menu do navegador.
				</p>
			{/if}
		</section>
	{/if}

	<section>
		<h2>Seus dados</h2>
		<p class="text">
			Tudo fica guardado neste aparelho, no navegador. Faça backups de vez em quando, principalmente
			antes de trocar de celular ou limpar os dados do navegador.
		</p>
		<div class="buttons">
			<Button variant="secondary" onclick={exportBackup}>Fazer backup</Button>
			<label class="file-btn">
				Restaurar backup
				<input
					type="file"
					accept="application/json,.json"
					class="sr-only"
					onchange={(e) => {
						const f = e.currentTarget.files?.[0];
						if (f) restore(f);
						e.currentTarget.value = '';
					}}
				/>
			</label>
		</div>
		{#if data.ready && data.accounts.length === 0}
			<div class="demo">
				<p class="text">Quer ver o app em uso antes de cadastrar suas contas?</p>
				<Button variant="secondary" onclick={demo} disabled={busy}
					>Carregar dados de demonstração</Button
				>
			</div>
		{/if}
	</section>

	<section>
		<Button variant="danger" onclick={wipe}>Apagar todos os dados</Button>
	</section>
</div>

<style>
	.page {
		padding-inline: 20px;
	}
	section {
		margin-bottom: 40px;
	}
	h2 {
		font-size: 22px;
		font-variation-settings: 'opsz' 48;
		margin-bottom: 12px;
	}
	.link {
		min-height: 54px;
		color: var(--ink);
	}
	.link :global(svg) {
		color: var(--ink-3);
	}
	.grow {
		flex: 1;
	}
	.count {
		color: var(--ink-3);
		font-size: 14px;
	}
	h3 {
		margin: 18px 0 10px;
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 500;
		color: var(--ink-2);
		letter-spacing: 0;
	}
	h2 + h3 {
		margin-top: 0;
	}
	.text {
		color: var(--ink-2);
		margin-bottom: 14px;
		max-width: 56ch;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
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
	.demo {
		margin-top: 28px;
		padding-top: 20px;
		border-top: 1px solid var(--rule);
	}
</style>

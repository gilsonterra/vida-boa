<script lang="ts">
	import { CloudCheck, CloudOff, LoaderCircle, TriangleAlert } from '@lucide/svelte';
	import { cloud, signOut, syncNow } from '../stores/sync.svelte';
	import { confirmAction, toast } from '../stores/ui.svelte';
	import Button from './Button.svelte';

	/** Seção de Ajustes: conta conectada, estado da sincronização e saída. */

	const rel = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
	function since(iso: string | null) {
		if (!iso) return '';
		const s = Math.round((Date.parse(iso) - Date.now()) / 1000);
		return Math.abs(s) < 60 ? 'agora' : rel.format(Math.round(s / 60), 'minute');
	}

	async function leave() {
		const erase = await confirmAction({
			title: 'Sair e apagar deste aparelho?',
			message:
				'Seus dados continuam na sua conta. Só a cópia deste aparelho será apagada. Recomendado em aparelhos que não são só seus.',
			confirmLabel: 'Sair e apagar',
			destructive: true
		});
		if (!erase) return;
		await signOut(true);
		toast('Você saiu e os dados deste aparelho foram apagados');
	}

	async function leaveKeeping() {
		await signOut(false);
		toast('Você saiu da conta');
	}
</script>

{#if cloud.user}
	<section>
		<h2>Conta</h2>
		<div class="status">
			<span class="ico {cloud.status}">
				{#if cloud.status === 'syncing'}<LoaderCircle size={18} class="spin" />
				{:else if cloud.status === 'offline'}<CloudOff size={18} />
				{:else if cloud.status === 'error'}<TriangleAlert size={18} />
				{:else}<CloudCheck size={18} />{/if}
			</span>
			<div>
				<strong>{cloud.user.email}</strong>
				<small>
					{#if cloud.status === 'syncing'}Sincronizando…
					{:else if cloud.status === 'offline'}Sem internet. As mudanças sobem quando a conexão
						voltar.
					{:else if cloud.status === 'error'}Não foi possível sincronizar: {cloud.error}
					{:else if cloud.lastSyncAt}Sincronizado {since(cloud.lastSyncAt)}
					{:else}Pronto para sincronizar{/if}
				</small>
			</div>
		</div>
		<div class="buttons">
			<Button variant="secondary" onclick={syncNow} disabled={cloud.status === 'syncing'}>
				Sincronizar agora
			</Button>
			<Button variant="secondary" onclick={leaveKeeping}>Sair</Button>
			<Button variant="danger" onclick={leave}>Sair e apagar daqui</Button>
		</div>
	</section>
{/if}

<style>
	section {
		margin-bottom: 40px;
	}
	h2 {
		font-size: 22px;
		font-variation-settings: 'opsz' 48;
		margin-bottom: 12px;
	}
	.status {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
	}
	.status strong {
		display: block;
		font-weight: 500;
		overflow-wrap: anywhere;
	}
	.status small {
		display: block;
		font-size: 13px;
		color: var(--ink-2);
	}
	.ico {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		flex-shrink: 0;
		background: var(--gain-soft);
		color: var(--gain);
	}
	.ico.offline,
	.ico.syncing {
		background: var(--sunken);
		color: var(--ink-2);
	}
	.ico.error {
		background: var(--loss-soft);
		color: var(--loss);
	}
	.ico :global(.spin) {
		animation: spin 900ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
</style>

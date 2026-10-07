<script lang="ts">
	import { CloudCheck, CloudOff, LoaderCircle, TriangleAlert } from '@lucide/svelte';
	import { cloud, signIn, signOut, signUp, syncNow } from '../stores/sync.svelte';
	import { confirmAction, toast } from '../stores/ui.svelte';
	import Button from './Button.svelte';
	import Segmented from './Segmented.svelte';
	import Sheet from './Sheet.svelte';

	/** Seção de Ajustes: entrar, criar conta, estado da sincronização e sair. */

	let open = $state(false);
	let mode = $state<'signin' | 'signup'>('signin');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);
	let confirmSent = $state(false);

	const rel = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
	function since(iso: string | null) {
		if (!iso) return '';
		const s = Math.round((Date.parse(iso) - Date.now()) / 1000);
		return Math.abs(s) < 60 ? 'agora' : rel.format(Math.round(s / 60), 'minute');
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (!/^\S+@\S+\.\S+$/.test(email)) return (error = 'Informe um e-mail válido.');
		if (password.length < 6) return (error = 'A senha precisa ter pelo menos 6 caracteres.');
		busy = true;
		try {
			const result =
				mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
			if (result === 'confirm') confirmSent = true;
			else if (result) error = result;
			else {
				open = false;
				password = '';
				toast('Conectado. Seus dados estão sendo sincronizados.');
			}
		} finally {
			busy = false;
		}
	}

	async function leave() {
		const erase = await confirmAction({
			title: 'Sair da conta',
			message:
				'Os dados continuam salvos na nuvem. Quer apagar também a cópia deste aparelho? Recomendado se o aparelho não for só seu.',
			confirmLabel: 'Sair e apagar daqui',
			destructive: true
		});
		await signOut(erase);
		toast(erase ? 'Você saiu e os dados deste aparelho foram apagados' : 'Você saiu da conta');
	}

	async function leaveKeeping() {
		await signOut(false);
		toast('Você saiu. Os dados continuam neste aparelho.');
	}
</script>

{#if cloud.available}
	<section>
		<h2>Conta e sincronização</h2>
		{#if cloud.user}
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
		{:else}
			<p class="text">
				Entre para guardar seus dados na nuvem e usar o Vida Boa em mais de um aparelho. Tudo
				continua funcionando sem internet; a sincronização acontece em segundo plano.
			</p>
			<div class="buttons">
				<Button
					onclick={() => {
						mode = 'signin';
						confirmSent = false;
						open = true;
					}}>Entrar</Button
				>
				<Button
					variant="secondary"
					onclick={() => {
						mode = 'signup';
						confirmSent = false;
						open = true;
					}}>Criar conta</Button
				>
			</div>
		{/if}
	</section>

	<Sheet bind:open title={mode === 'signin' ? 'Entrar' : 'Criar conta'}>
		{#if confirmSent}
			<p class="text">
				Enviamos um link de confirmação para <strong>{email}</strong>. Abra o e-mail, confirme e
				depois entre com sua senha.
			</p>
			<Button
				block
				onclick={() => {
					confirmSent = false;
					mode = 'signin';
				}}>Já confirmei, quero entrar</Button
			>
		{:else}
			<form id="auth-form" onsubmit={submit} novalidate>
				<Segmented
					label="Ação"
					bind:value={mode}
					options={[
						{ value: 'signin', label: 'Entrar' },
						{ value: 'signup', label: 'Criar conta' }
					]}
				/>
				<label>
					<span class="field-label">E-mail</span>
					<input class="input" type="email" autocomplete="email" bind:value={email} />
				</label>
				<label>
					<span class="field-label">Senha</span>
					<input
						class="input"
						type="password"
						autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
						bind:value={password}
					/>
				</label>
				{#if mode === 'signup'}
					<p class="hint">
						Os dados que já estão neste aparelho vão para a sua conta na primeira sincronização.
					</p>
				{/if}
				{#if error}<p class="err" role="alert">{error}</p>{/if}
			</form>
		{/if}
		{#snippet footer()}
			{#if !confirmSent}
				<Button type="submit" form="auth-form" size="lg" block disabled={busy}>
					{busy ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
				</Button>
			{/if}
		{/snippet}
	</Sheet>
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
	.text {
		color: var(--ink-2);
		margin-bottom: 14px;
		max-width: 56ch;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.hint {
		font-size: 13px;
		color: var(--ink-3);
	}
	.err {
		color: var(--danger);
		font-size: 14px;
	}
</style>

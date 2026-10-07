<script lang="ts">
	import { Eye, EyeOff, Gem, WifiOff } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import {
		cloud,
		requestPasswordReset,
		signIn,
		signUp,
		updatePassword
	} from '../stores/sync.svelte';
	import { toast } from '../stores/ui.svelte';
	import Button from './Button.svelte';

	/**
	 * Tela de entrada: o app só funciona com uma conta. Também atende quem chega pelo
	 * link de "esqueci minha senha" (modo nova senha).
	 */
	type Mode = 'signin' | 'signup' | 'forgot';

	let mode = $state<Mode>('signin');
	let email = $state('');
	let password = $state('');
	let confirm = $state('');
	let showPassword = $state(false);
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');
	let online = $state(true);

	onMount(() => {
		const update = () => (online = navigator.onLine);
		update();
		addEventListener('online', update);
		addEventListener('offline', update);
		return () => {
			removeEventListener('online', update);
			removeEventListener('offline', update);
		};
	});

	const recovering = $derived(cloud.recovery);
	const title = $derived(
		recovering
			? 'Defina uma nova senha'
			: mode === 'signin'
				? 'Que bom ver você'
				: mode === 'signup'
					? 'Crie sua conta'
					: 'Recuperar acesso'
	);

	function go(next: Mode) {
		mode = next;
		error = '';
		notice = '';
		password = '';
		confirm = '';
	}

	const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (!online) return (error = 'Conecte-se à internet para continuar.');

		if (recovering) {
			if (password.length < 8) return (error = 'Use pelo menos 8 caracteres.');
			if (password !== confirm) return (error = 'As senhas não conferem.');
			busy = true;
			const result = await updatePassword(password);
			busy = false;
			if (result) error = result;
			else toast('Senha alterada');
			return;
		}

		if (!validEmail(email)) return (error = 'Informe um e-mail válido.');
		busy = true;
		try {
			if (mode === 'forgot') {
				const result = await requestPasswordReset(email.trim());
				// Mesma mensagem exista ou não a conta, para não revelar quem está cadastrado.
				// Só erros de rede ou de excesso de tentativas aparecem como erro.
				const transient = result && /tentativas|conexão/i.test(result);
				if (transient) error = result!;
				else notice = sentMessage();
				return;
			}
			if (mode === 'signup') {
				if (password.length < 8) return (error = 'Use pelo menos 8 caracteres.');
				if (password !== confirm) return (error = 'As senhas não conferem.');
				const result = await signUp(email.trim(), password);
				if (result === 'confirm') {
					notice = `Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail neste aparelho para concluir.`;
					password = '';
					confirm = '';
				} else if (result) error = result;
				return;
			}
			const result = await signIn(email.trim(), password);
			if (result) error = result;
		} finally {
			busy = false;
		}
	}

	function sentMessage() {
		return `Se houver uma conta para ${email.trim()}, você vai receber um link para criar uma nova senha. Abra-o neste aparelho.`;
	}
</script>

<div class="screen pt-safe pb-safe">
	<div class="column">
		<header class="brand">
			<span class="gem"><Gem size={30} strokeWidth={1.3} /></span>
			<span class="name">Vida Boa</span>
		</header>

		<h1>{title}</h1>
		<p class="lead">
			{#if recovering}
				Escolha a senha que vai usar daqui em diante.
			{:else if mode === 'signin'}
				Entre para ver suas finanças. Funciona também sem internet depois do primeiro acesso.
			{:else if mode === 'signup'}
				Seus dados ficam no seu aparelho e na sua conta, sincronizados entre os dois.
			{:else}
				Informe seu e-mail e enviaremos um link para criar uma nova senha.
			{/if}
		</p>

		{#if !online}
			<p class="offline" role="status">
				<WifiOff size={16} strokeWidth={1.8} />Sem internet. Conecte-se para entrar.
			</p>
		{/if}

		{#if notice}
			<div class="notice" role="status">
				<p>{notice}</p>
				<button type="button" class="link" onclick={() => go('signin')}>Voltar para entrar</button>
			</div>
		{:else}
			<form onsubmit={submit} novalidate>
				{#if !recovering}
					<label>
						<span class="field-label">E-mail</span>
						<input
							class="input"
							type="email"
							inputmode="email"
							autocomplete="email"
							autocapitalize="none"
							spellcheck="false"
							bind:value={email}
						/>
					</label>
				{/if}

				{#if mode !== 'forgot' || recovering}
					<label>
						<span class="field-label">{recovering ? 'Nova senha' : 'Senha'}</span>
						<span class="pw">
							<input
								class="input"
								type={showPassword ? 'text' : 'password'}
								autocomplete={mode === 'signin' && !recovering
									? 'current-password'
									: 'new-password'}
								bind:value={password}
							/>
							<button
								type="button"
								class="reveal"
								onclick={() => (showPassword = !showPassword)}
								aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
							>
								{#if showPassword}<EyeOff size={18} strokeWidth={1.6} />{:else}<Eye
										size={18}
										strokeWidth={1.6}
									/>{/if}
							</button>
						</span>
					</label>
				{/if}

				{#if mode === 'signup' || recovering}
					<label>
						<span class="field-label">Confirme a senha</span>
						<input
							class="input"
							type={showPassword ? 'text' : 'password'}
							autocomplete="new-password"
							bind:value={confirm}
						/>
					</label>
				{/if}

				{#if error}<p class="err" role="alert">{error}</p>{/if}

				<Button type="submit" size="lg" block disabled={busy || !online}>
					{#if busy}Aguarde…
					{:else if recovering}Salvar nova senha
					{:else if mode === 'signin'}Entrar
					{:else if mode === 'signup'}Criar conta
					{:else}Enviar link{/if}
				</Button>
			</form>

			{#if !recovering}
				<nav class="switch">
					{#if mode === 'signin'}
						<button type="button" class="link" onclick={() => go('forgot')}
							>Esqueci minha senha</button
						>
						<span
							>Não tem conta? <button type="button" class="link" onclick={() => go('signup')}
								>Criar conta</button
							></span
						>
					{:else}
						<span
							>Já tem conta? <button type="button" class="link" onclick={() => go('signin')}
								>Entrar</button
							></span
						>
					{/if}
				</nav>
			{/if}
		{/if}

		<p class="fine">Só você tem acesso aos seus dados.</p>
	</div>
</div>

<style>
	.screen {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding-inline: 24px;
		background: var(--paper);
	}
	.column {
		width: 100%;
		max-width: 400px;
		padding: 40px 0;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 44px;
	}
	.gem {
		color: var(--brass);
	}
	.name {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 330;
		font-size: 26px;
		font-variation-settings: 'opsz' 144;
	}
	h1 {
		font-size: clamp(34px, 9vw, 42px);
		font-weight: 300;
		font-variation-settings: 'opsz' 144;
		letter-spacing: -0.025em;
	}
	.lead {
		margin-top: 10px;
		color: var(--ink-2);
		line-height: 1.6;
	}
	.offline {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 20px;
		padding: 10px 14px;
		border-radius: 12px;
		background: var(--sunken);
		color: var(--ink-2);
		font-size: 14px;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-top: 32px;
	}
	.pw {
		position: relative;
		display: block;
	}
	.pw .input {
		padding-right: 48px;
	}
	.reveal {
		position: absolute;
		top: 50%;
		right: 6px;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 99px;
		color: var(--ink-3);
	}
	.err {
		color: var(--danger);
		font-size: 14px;
	}
	.notice {
		margin-top: 32px;
		padding: 18px;
		border-radius: 16px;
		background: var(--accent-soft);
		line-height: 1.6;
	}
	.notice .link {
		margin-top: 10px;
	}
	.switch {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		margin-top: 24px;
		font-size: 14px;
		color: var(--ink-2);
	}
	.link {
		color: var(--accent);
		font-weight: 500;
	}
	.fine {
		margin-top: 48px;
		font-size: 12.5px;
		color: var(--ink-3);
	}
</style>

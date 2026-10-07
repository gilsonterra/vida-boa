import type { RealtimeChannel, SupabaseClient, User } from '@supabase/supabase-js';
import { db, store } from '../data';
import { onChange } from '../data/changes';
import {
	adoptAccount,
	clearLocal,
	getOwner,
	syncOnce,
	type RemoteAdapter
} from '../data/sync/engine';
import { cloudAvailable, getClient, supabaseRemote } from '../data/sync/supabase';
import { confirmAction } from './ui.svelte';

/**
 * Sessão (o app exige login) e sincronização com o Supabase.
 *
 * Sincroniza ao entrar, ao abrir o app, ao voltar a ficar online, pouco depois de cada
 * alteração local, a cada 5 minutos e quando o Realtime avisa que outro aparelho mudou algo.
 * Quem já entrou uma vez continua usando o app sem internet: a sessão fica no aparelho.
 */

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error';

interface SessionUser {
	id: string;
	email: string;
}

export const cloud = $state({
	available: cloudAvailable,
	/** A verificação inicial da sessão terminou. */
	ready: false,
	user: null as SessionUser | null,
	/** Chegou pelo link de "esqueci minha senha": precisa definir uma nova. */
	recovery: false,
	status: 'off' as SyncStatus,
	lastSyncAt: null as string | null,
	error: null as string | null
});

const LOCAL_DEBOUNCE_MS = 1500;
const INTERVAL_MS = 5 * 60_000;
/** Último usuário que entrou, para abrir o app offline mesmo se o token tiver expirado. */
const CACHED_USER_KEY = 'vb:user';

let client: SupabaseClient | null = null;
let remote: RemoteAdapter | null = null;
let channel: RealtimeChannel | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;
let stopListening: (() => void) | null = null;
let running = false;
let again = false;
let starting: Promise<boolean> | null = null;

function readCachedUser(): SessionUser | null {
	try {
		const raw = localStorage.getItem(CACHED_USER_KEY);
		const parsed = raw ? (JSON.parse(raw) as SessionUser) : null;
		return parsed && typeof parsed.id === 'string' ? parsed : null;
	} catch {
		return null;
	}
}

function writeCachedUser(user: SessionUser | null) {
	try {
		if (user) localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
		else localStorage.removeItem(CACHED_USER_KEY);
	} catch {
		/* armazenamento indisponível */
	}
}

const toSessionUser = (u: User): SessionUser => ({ id: u.id, email: u.email ?? '' });

export async function initCloud() {
	if (!cloud.available) {
		cloud.ready = true;
		return;
	}
	try {
		client = await getClient();
		remote = supabaseRemote(client);

		client.auth.onAuthStateChange((event, session) => {
			// O supabase-js pede callbacks síncronos: o trabalho assíncrono vai para depois.
			setTimeout(() => {
				if (event === 'PASSWORD_RECOVERY') cloud.recovery = true;
				if (event === 'SIGNED_OUT') stop();
				if (session?.user && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY'))
					void ensureStarted(toSessionUser(session.user));
				if (event === 'TOKEN_REFRESHED' && cloud.user) schedule(0);
			});
		});

		// Também conclui o login vindo de um link de e-mail (?code=…).
		const { data, error } = await client.auth.getSession();
		cleanAuthParams();
		if (data.session?.user) {
			await ensureStarted(toSessionUser(data.session.user));
		} else if (error || !navigator.onLine) {
			// Sem rede para renovar a sessão: segue com o último usuário deste aparelho.
			const cached = readCachedUser();
			if (cached && (await getOwner(db)) === cached.id) {
				cloud.user = cached;
				cloud.status = 'offline';
				startListeners();
			}
		}
	} catch (err) {
		cloud.error = (err as Error).message;
	} finally {
		cloud.ready = true;
	}
}

/** Tira ?code= e afins da barra de endereço depois do login por link. */
function cleanAuthParams() {
	const url = new URL(location.href);
	let changed = false;
	for (const k of ['code', 'error', 'error_code', 'error_description']) {
		if (url.searchParams.has(k)) {
			url.searchParams.delete(k);
			changed = true;
		}
	}
	if (changed) history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

/** Liga a sincronização para o usuário; idempotente (um login dispara mais de um evento). */
function ensureStarted(user: SessionUser): Promise<boolean> {
	if (cloud.user?.id === user.id && stopListening) return Promise.resolve(true);
	starting ??= start(user).finally(() => (starting = null));
	return starting;
}

async function start(user: SessionUser): Promise<boolean> {
	if (!(await guardOwner(user.id))) {
		await client?.auth.signOut({ scope: 'local' });
		return false;
	}
	stop();
	await adoptAccount(db, remote!, user.id);
	// Conta nova e aparelho limpo: recria os dados iniciais, que sobem na sincronização.
	if ((await db.categories.count()) === 0) {
		await db.meta.bulkDelete(['seeded', 'seedVersion']);
		await store.ensureSeed();
	}
	cloud.user = user;
	cloud.status = 'idle';
	writeCachedUser(user);
	startListeners();
	void syncNow();
	return true;
}

function startListeners() {
	stopListening?.();
	stopListening = onChange((origin) => origin === 'local' && schedule(LOCAL_DEBOUNCE_MS));
	interval = setInterval(() => schedule(0), INTERVAL_MS);
	addEventListener('online', onOnline);
	document.addEventListener('visibilitychange', onVisible);
	if (client && !channel) {
		channel = client
			.channel('vida-boa-sync')
			.on('postgres_changes', { event: '*', schema: 'public' }, () => schedule(400))
			.subscribe();
	}
}

function stop() {
	cloud.user = null;
	cloud.status = 'off';
	cloud.lastSyncAt = null;
	stopListening?.();
	stopListening = null;
	if (interval) clearInterval(interval);
	if (timer) clearTimeout(timer);
	removeEventListener('online', onOnline);
	document.removeEventListener('visibilitychange', onVisible);
	if (channel) client?.removeChannel(channel);
	channel = null;
}

const onOnline = () => schedule(0);
const onVisible = () => document.visibilityState === 'visible' && schedule(0);

function schedule(delay: number) {
	if (!cloud.user) return;
	if (timer) clearTimeout(timer);
	timer = setTimeout(syncNow, delay);
}

export async function syncNow() {
	if (!cloud.user || !remote) return;
	if (running) {
		again = true;
		return;
	}
	if (!navigator.onLine) {
		cloud.status = 'offline';
		return;
	}
	running = true;
	cloud.status = 'syncing';
	try {
		await syncOnce(db, remote, cloud.user.id);
		cloud.status = 'idle';
		cloud.error = null;
		cloud.lastSyncAt = new Date().toISOString();
	} catch (err) {
		cloud.status = navigator.onLine ? 'error' : 'offline';
		cloud.error = (err as Error).message;
	} finally {
		running = false;
		if (again) {
			again = false;
			schedule(0);
		}
	}
}

/** Traduz os erros mais comuns do Supabase Auth. */
function authMessage(message: string): string {
	const m = message.toLowerCase();
	if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
	if (m.includes('email not confirmed'))
		return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
	if (m.includes('already registered')) return 'Já existe uma conta com este e-mail. Use Entrar.';
	if (m.includes('rate limit') || m.includes('security purposes'))
		return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
	if (m.includes('same') && m.includes('password'))
		return 'A nova senha precisa ser diferente da anterior.';
	if (m.includes('password'))
		return 'Senha não aceita. Use pelo menos 8 caracteres, misturando letras e números.';
	if (m.includes('fetch') || m.includes('network'))
		return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
	return message;
}

/**
 * Antes de vincular o aparelho a uma conta: se ele já tem dados de OUTRA conta,
 * pede confirmação para apagá-los (nunca mistura contas).
 */
async function guardOwner(userId: string): Promise<boolean> {
	const owner = await getOwner(db);
	if (!owner || owner === userId) return true;
	const ok = await confirmAction({
		title: 'Este aparelho tem dados de outra conta',
		message:
			'Para entrar com esta conta, os dados guardados aqui serão apagados. Os que já foram sincronizados continuam na outra conta.',
		confirmLabel: 'Apagar e entrar',
		destructive: true
	});
	if (ok) await clearLocal(db);
	return ok;
}

/** Endereço do app sem rota nem parâmetros: para onde os links de e-mail voltam. */
const redirectTo = () => location.href.split('#')[0].split('?')[0];

export async function signIn(email: string, password: string): Promise<string | null> {
	const c = await getClient();
	const { data, error } = await c.auth.signInWithPassword({ email, password });
	if (error) return authMessage(error.message);
	const ok = await ensureStarted(toSessionUser(data.user));
	return ok ? null : 'Entrada cancelada.';
}

/** Devolve um erro, ou `confirm` quando o projeto exige confirmação por e-mail. */
export async function signUp(email: string, password: string): Promise<string | 'confirm' | null> {
	const c = await getClient();
	const { data, error } = await c.auth.signUp({
		email,
		password,
		options: { emailRedirectTo: redirectTo() }
	});
	if (error) return authMessage(error.message);
	// Com confirmação ativa o Supabase não diz se o e-mail já existia (evita descobrir contas).
	if (!data.session || !data.user) return 'confirm';
	const ok = await ensureStarted(toSessionUser(data.user));
	return ok ? null : 'Cadastro feito, mas a entrada foi cancelada.';
}

export async function requestPasswordReset(email: string): Promise<string | null> {
	const c = await getClient();
	const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
	return error ? authMessage(error.message) : null;
}

export async function updatePassword(password: string): Promise<string | null> {
	const c = await getClient();
	const { error } = await c.auth.updateUser({ password });
	if (error) return authMessage(error.message);
	cloud.recovery = false;
	return null;
}

/** Sai da conta. Com `erase`, apaga também os dados deste aparelho. */
export async function signOut(erase: boolean) {
	if (cloud.user && navigator.onLine) await syncNow();
	stop();
	writeCachedUser(null);
	await client?.auth.signOut({ scope: 'local' });
	if (erase) await store.wipe();
}

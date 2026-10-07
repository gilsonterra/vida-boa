import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
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
 * Sessão e sincronização com o Supabase. Sincroniza ao entrar, ao abrir o app, ao voltar
 * a ficar online, pouco depois de cada alteração local, a cada 5 minutos e quando o
 * Realtime avisa que outro aparelho mudou algo.
 */

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error';

export const cloud = $state({
	available: cloudAvailable,
	ready: false,
	user: null as { id: string; email: string } | null,
	status: 'off' as SyncStatus,
	lastSyncAt: null as string | null,
	error: null as string | null
});

const LOCAL_DEBOUNCE_MS = 1500;
const INTERVAL_MS = 5 * 60_000;

let client: SupabaseClient | null = null;
let remote: RemoteAdapter | null = null;
let channel: RealtimeChannel | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;
let stopListening: (() => void) | null = null;
let running = false;
let again = false;

export async function initCloud() {
	if (!cloud.available) return;
	try {
		client = await getClient();
		remote = supabaseRemote(client);
		const { data } = await client.auth.getSession();
		if (data.session?.user) await start(data.session.user.id, data.session.user.email ?? '');
		client.auth.onAuthStateChange((event, session) => {
			if (event === 'SIGNED_OUT') stop();
			if (event === 'TOKEN_REFRESHED' && session?.user && cloud.user) schedule(0);
		});
	} catch (err) {
		cloud.error = (err as Error).message;
	} finally {
		cloud.ready = true;
	}
}

async function start(id: string, email: string) {
	stop();
	cloud.user = { id, email };
	cloud.status = 'idle';
	await adoptAccount(db, remote!, id);
	// Conta nova e aparelho limpo: recria os dados iniciais, que sobem na sincronização.
	if ((await db.categories.count()) === 0) {
		await db.meta.bulkDelete(['seeded', 'seedVersion']);
		await store.ensureSeed();
	}

	stopListening?.();
	stopListening = onChange((origin) => origin === 'local' && schedule(LOCAL_DEBOUNCE_MS));
	interval = setInterval(() => schedule(0), INTERVAL_MS);
	addEventListener('online', onOnline);
	document.addEventListener('visibilitychange', onVisible);

	channel = client!
		.channel('vida-boa-sync')
		.on('postgres_changes', { event: '*', schema: 'public' }, () => schedule(400))
		.subscribe();

	await syncNow();
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
	if (m.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.';
	if (m.includes('fetch') || m.includes('network'))
		return 'Sem conexão com o servidor. Tente de novo.';
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

export async function signIn(email: string, password: string): Promise<string | null> {
	const c = await getClient();
	const { data, error } = await c.auth.signInWithPassword({ email, password });
	if (error) return authMessage(error.message);
	if (!(await guardOwner(data.user.id))) {
		await c.auth.signOut();
		return 'Entrada cancelada.';
	}
	await start(data.user.id, data.user.email ?? email);
	return null;
}

/** Devolve um erro, ou `confirm` quando o projeto exige confirmação por e-mail. */
export async function signUp(email: string, password: string): Promise<string | 'confirm' | null> {
	const c = await getClient();
	const { data, error } = await c.auth.signUp({
		email,
		password,
		options: { emailRedirectTo: location.href.split('#')[0] }
	});
	if (error) return authMessage(error.message);
	if (!data.session || !data.user) return 'confirm';
	if (!(await guardOwner(data.user.id))) {
		await c.auth.signOut();
		return 'Cadastro feito, mas a entrada foi cancelada.';
	}
	await start(data.user.id, data.user.email ?? email);
	return null;
}

/** Sai da conta. Com `erase`, apaga também os dados deste aparelho. */
export async function signOut(erase: boolean) {
	if (cloud.user && navigator.onLine) await syncNow();
	stop();
	await client?.auth.signOut();
	if (erase) await store.wipe();
}

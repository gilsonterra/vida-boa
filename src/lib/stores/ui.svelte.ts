import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { ID, ISODate, RecurringRule, Transaction, TransactionKind } from '../domain/types';

/** Estado de interface compartilhado: editor de lançamento, avisos e confirmações. */

export interface EditorRequest {
	/** Lançamento a editar; ausente para criar um novo. */
	transaction?: Transaction;
	/** Ocorrência prevista de uma recorrência (ainda não lançada) a editar. */
	occurrence?: { rule: RecurringRule; date: ISODate };
	defaults?: { kind?: TransactionKind; accountId?: ID };
}

interface Toast {
	id: number;
	message: string;
	action?: { label: string; run: () => void };
}

interface ConfirmRequest {
	title: string;
	message: string;
	confirmLabel: string;
	destructive: boolean;
	resolve: (ok: boolean) => void;
}

export const ui = $state({
	editor: null as EditorRequest | null,
	toasts: [] as Toast[],
	confirm: null as ConfirmRequest | null,
	updateReady: false,
	/** Oculta os valores na tela (para usar o app em público). */
	privacy: readPrivacy()
});

function readPrivacy(): boolean {
	try {
		return localStorage.getItem('vb:privacy') === '1';
	} catch {
		return false;
	}
}

export function togglePrivacy() {
	ui.privacy = !ui.privacy;
	try {
		localStorage.setItem('vb:privacy', ui.privacy ? '1' : '0');
	} catch {
		/* só nesta sessão */
	}
}

export function openEditor(req: EditorRequest = {}) {
	ui.editor = req;
}

export function closeEditor() {
	ui.editor = null;
}

/** Conta a filtrar quando o Extrato abrir (vinda do card ou da lista de contas). */
let pendingStatementAccount: ID | null = null;

/** Abre o Extrato já filtrado por uma conta: a "tela da conta" é o próprio extrato. */
export function openStatement(accountId: ID) {
	pendingStatementAccount = accountId;
	void goto(resolve('/extrato'));
}

/** Lê (uma vez) a conta pedida por `openStatement`. */
export function takeStatementAccount(): ID | null {
	const id = pendingStatementAccount;
	pendingStatementAccount = null;
	return id;
}

let toastSeq = 0;

export function toast(message: string, action?: Toast['action']) {
	const id = ++toastSeq;
	ui.toasts = [...ui.toasts, { id, message, action }];
	setTimeout(() => dismissToast(id), action ? 6000 : 3200);
}

export function dismissToast(id: number) {
	ui.toasts = ui.toasts.filter((t) => t.id !== id);
}

export function confirmAction(opts: {
	title: string;
	message: string;
	confirmLabel: string;
	destructive?: boolean;
}): Promise<boolean> {
	return new Promise((resolve) => {
		ui.confirm = { destructive: false, ...opts, resolve };
	});
}

export function answerConfirm(ok: boolean) {
	ui.confirm?.resolve(ok);
	ui.confirm = null;
}

/** Vibração curta em ações confirmadas (só onde o aparelho suporta). */
export function haptic(ms = 8) {
	try {
		navigator.vibrate?.(ms);
	} catch {
		/* sem suporte */
	}
}

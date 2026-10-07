/**
 * Sinal de "os dados mudaram", independente do banco. Toda escrita chama `notifyChange()`,
 * e as consultas reativas da UI se recalculam. Outras abas abertas são avisadas via
 * BroadcastChannel. A origem diz se a mudança foi feita aqui ou veio da nuvem, para a
 * sincronização não reenviar o que acabou de baixar.
 */

export type ChangeOrigin = 'local' | 'remote';
type Listener = (origin: ChangeOrigin) => void;
const listeners = new Set<Listener>();

const channel =
	typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('vida-boa:changes') : null;
// Mudanças de outra aba já foram (ou serão) sincronizadas por ela.
channel?.addEventListener('message', () => emit('remote'));

function emit(origin: ChangeOrigin) {
	for (const l of listeners) l(origin);
}

export function notifyChange(origin: ChangeOrigin = 'local'): void {
	emit(origin);
	channel?.postMessage(origin);
}

export function onChange(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

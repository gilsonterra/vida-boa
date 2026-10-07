/**
 * Sinal de "os dados mudaram", independente do banco. Toda escrita chama `notifyChange()`,
 * e as consultas reativas da UI se recalculam. Outras abas abertas são avisadas via
 * BroadcastChannel. O Supabase Realtime poderá chamar o mesmo `notifyChange()` no futuro.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

const channel =
	typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('vida-boa:changes') : null;
channel?.addEventListener('message', () => emit());

function emit() {
	for (const l of listeners) l();
}

export function notifyChange(): void {
	emit();
	channel?.postMessage('change');
}

export function onChange(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

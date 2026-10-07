import { onChange } from './changes';

/**
 * Consulta reativa: executa `query` e roda de novo quando os dados mudam
 * (qualquer escrita) ou quando o estado reativo lido por ela muda.
 *
 * Importante: leia o estado reativo de que a consulta depende ANTES do primeiro `await`,
 * porque só a parte síncrona é rastreada pelo Svelte:
 *   const txs = live(() => { const m = month; return store.transactions.list(); }, []);
 *
 * Precisa ser criada durante a inicialização de um componente (usa `$effect`).
 */
export function live<T>(query: () => Promise<T>, initial: T) {
	let revision = $state(0);
	const state = $state({ current: initial, loading: true, error: null as Error | null });

	$effect(() => onChange(() => revision++));

	let ticket = 0;
	$effect(() => {
		void revision;
		const mine = ++ticket;
		query().then(
			(value) => {
				// Descarta respostas atrasadas de consultas já substituídas.
				if (mine !== ticket) return;
				state.current = value;
				state.loading = false;
				state.error = null;
			},
			(error: Error) => {
				if (mine !== ticket) return;
				state.error = error;
				state.loading = false;
			}
		);
	});

	return state;
}

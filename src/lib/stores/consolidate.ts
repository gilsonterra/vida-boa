import { store } from '../data';
import { withInstallmentStatus } from '../domain/ledger';
import type { ISODate, Loan, RecurringRule, Transaction } from '../domain/types';
import { haptic, toast } from './ui.svelte';

/** Marcar/desmarcar consolidado direto na linha, com desfazer. */
export async function setTransactionConsolidated(t: Transaction, consolidated: boolean) {
	haptic();
	await store.transactions.update(t.id, { consolidated });
	toast(consolidated ? 'Consolidado' : 'Marcado como pendente', {
		label: 'Desfazer',
		run: () => store.transactions.update(t.id, { consolidated: !consolidated })
	});
}

/** Consolidar uma recorrência prevista: lança a ocorrência agora, já consolidada. */
export async function launchRecurring(rule: RecurringRule, date: ISODate) {
	haptic();
	const id = await store.recurring.launchOccurrence(rule.id, date, { consolidated: true });
	if (!id) return toast('Essa ocorrência já foi lançada');
	toast('Lançado e consolidado', {
		label: 'Desfazer',
		run: () => store.transactions.remove(id)
	});
}

export async function setInstallmentConsolidated(loan: Loan, n: number, consolidated: boolean) {
	haptic();
	const previous = { ...loan.installmentStatus };
	await store.loans.update(loan.id, {
		installmentStatus: withInstallmentStatus(loan, n, consolidated)
	});
	toast(consolidated ? `Parcela ${n} paga` : `Parcela ${n} pendente`, {
		label: 'Desfazer',
		run: () => store.loans.update(loan.id, { installmentStatus: previous })
	});
}

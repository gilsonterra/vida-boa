-- Vida Boa: lançamento consolidado.
-- Só lançamentos consolidados (pagos/recebidos) contam no saldo. Os que já existiam ficam
-- consolidados; os de data futura chegam do aparelho como pendentes. Pode rodar de novo sem problema.

alter table public.transactions
	add column if not exists consolidated boolean not null default true;

-- Parcelas de financiamento marcadas à mão como consolidadas/pendentes, pelo número
-- ({"3": true, "7": false}). As que não estão ali seguem a data de vencimento.
alter table public.loans
	add column if not exists installment_status jsonb not null default '{}'::jsonb;

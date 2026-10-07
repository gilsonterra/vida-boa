-- Vida Boa: saldo devedor informado pelo banco (ex.: correção pela TR).
-- Gravado em loan_prepayments com effect = 'balance'; amount_cents é o saldo novo e não
-- gera lançamento. Pode rodar de novo sem problema.

alter table public.loan_prepayments drop constraint if exists loan_prepayments_effect_chk;
alter table public.loan_prepayments
	add constraint loan_prepayments_effect_chk check (effect in ('term','installment','balance'));

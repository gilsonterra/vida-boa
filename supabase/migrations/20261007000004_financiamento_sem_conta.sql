-- Vida Boa: financiamento sem conta.
-- O financiamento só acompanha a dívida; as parcelas e amortizações não geram mais lançamentos,
-- então conta e categoria deixam de ser obrigatórias. Pode rodar de novo sem problema.

alter table public.loans alter column account_id drop not null;
alter table public.loan_prepayments alter column account_id drop not null;

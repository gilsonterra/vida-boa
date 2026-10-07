-- Vida Boa: financiamentos e amortizações extras.
--
-- Só o contrato é gravado; a tabela de parcelas é calculada no aparelho. As parcelas pagas
-- viram lançamentos comuns (tabela transactions), com id determinístico por parcela.
-- Mesmas regras das outras tabelas: chave (user_id, id), vence o updated_at mais recente,
-- exclusão lógica e RLS por dono. Pode rodar de novo sem problema.

create table if not exists public.loans (
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	id uuid not null,
	name text not null,
	kind text not null,
	mode text not null,
	system text not null,
	principal_cents bigint not null default 0,
	rate_percent numeric not null default 0,
	rate_period text not null default 'month',
	installment_cents bigint not null default 0,
	term_months integer not null,
	first_due_date date not null,
	paid_before integer not null default 0,
	account_id uuid not null,
	category_id uuid,
	created_at timestamptz not null,
	updated_at timestamptz not null,
	deleted_at timestamptz,
	server_updated_at timestamptz not null default clock_timestamp(),
	primary key (user_id, id),
	constraint loans_kind_chk check (kind in ('home','vehicle','personal','other')),
	constraint loans_mode_chk check (mode in ('contract','simple')),
	constraint loans_system_chk check (system in ('price','sac')),
	constraint loans_rate_period_chk check (rate_period in ('month','year')),
	constraint loans_name_len_chk check (char_length(name) between 1 and 120),
	constraint loans_amounts_chk check (
		principal_cents between 0 and 999999999999 and installment_cents between 0 and 999999999999
	),
	constraint loans_rate_chk check (rate_percent between 0 and 1000),
	constraint loans_term_chk check (term_months between 1 and 600 and paid_before between 0 and term_months)
);

create table if not exists public.loan_prepayments (
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	id uuid not null,
	loan_id uuid not null,
	date date not null,
	amount_cents bigint not null,
	effect text not null,
	account_id uuid not null,
	created_at timestamptz not null,
	updated_at timestamptz not null,
	deleted_at timestamptz,
	server_updated_at timestamptz not null default clock_timestamp(),
	primary key (user_id, id),
	constraint loan_prepayments_effect_chk check (effect in ('term','installment')),
	constraint loan_prepayments_amount_chk check (amount_cents > 0 and amount_cents < 1000000000000)
);

do $$
declare
	t text;
begin
	foreach t in array array['loans', 'loan_prepayments']
	loop
		execute format('create index if not exists %I on public.%I (user_id, server_updated_at)', t || '_sync_idx', t);
		execute format('drop trigger if exists %I on public.%I', t || '_before_write', t);
		execute format(
			'create trigger %I before insert or update on public.%I for each row execute function public.vb_before_write()',
			t || '_before_write', t
		);
		execute format('alter table public.%I enable row level security', t);
		execute format('drop policy if exists %I on public.%I', t || ': dono', t);
		execute format(
			'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
			t || ': dono', t
		);
		execute format('revoke all on public.%I from anon', t);
		execute format('grant select, insert, update on public.%I to authenticated', t);
		if not exists (
			select 1 from pg_publication_tables
			where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
		) then
			execute format('alter publication supabase_realtime add table public.%I', t);
		end if;
	end loop;
end;
$$;

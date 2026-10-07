-- Vida Boa: réplica na nuvem do banco local (IndexedDB).
--
-- O app grava primeiro no aparelho e sincroniza depois. Por isso:
-- * a chave é (user_id, id): o id é UUID gerado no aparelho;
-- * nada é apagado de verdade: deleted_at marca a exclusão e também sincroniza;
-- * updated_at vem do aparelho e decide conflitos (vence a edição mais recente);
-- * server_updated_at é o relógio do servidor, usado como cursor para baixar mudanças.
--
-- Rode este arquivo uma vez no SQL Editor do Supabase (ou com `supabase db push`).

-- Mantém a versão mais recente e carimba o horário do servidor.
create or replace function public.vb_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
		-- O aparelho mandou uma versão mais antiga (ou a mesma): fica a do servidor.
		return null;
	end if;
	new.server_updated_at := clock_timestamp();
	return new;
end;
$$;

create table if not exists public.account_types (
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	id uuid not null,
	name text not null,
	kind text not null,
	is_system boolean not null default false,
	created_at timestamptz not null,
	updated_at timestamptz not null,
	deleted_at timestamptz,
	server_updated_at timestamptz not null default clock_timestamp(),
	primary key (user_id, id)
);

create index if not exists account_types_sync_idx on public.account_types (user_id, server_updated_at);

drop trigger if exists account_types_before_write on public.account_types;
create trigger account_types_before_write
	before insert or update on public.account_types
	for each row execute function public.vb_before_write();

alter table public.account_types enable row level security;

drop policy if exists "account_types: dono" on public.account_types;
create policy "account_types: dono" on public.account_types
	for all to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

revoke all on public.account_types from anon;
grant select, insert, update on public.account_types to authenticated;

create table if not exists public.accounts (
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	id uuid not null,
	name text not null,
	type_id uuid not null,
	institution text not null default '',
	color text not null,
	initial_balance_cents bigint not null default 0,
	currency text not null default 'BRL',
	archived boolean not null default false,
	ofx_bank_id text,
	ofx_account_id text,
	created_at timestamptz not null,
	updated_at timestamptz not null,
	deleted_at timestamptz,
	server_updated_at timestamptz not null default clock_timestamp(),
	primary key (user_id, id)
);

create index if not exists accounts_sync_idx on public.accounts (user_id, server_updated_at);

drop trigger if exists accounts_before_write on public.accounts;
create trigger accounts_before_write
	before insert or update on public.accounts
	for each row execute function public.vb_before_write();

alter table public.accounts enable row level security;

drop policy if exists "accounts: dono" on public.accounts;
create policy "accounts: dono" on public.accounts
	for all to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

revoke all on public.accounts from anon;
grant select, insert, update on public.accounts to authenticated;

create table if not exists public.categories (
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	id uuid not null,
	name text not null,
	kind text not null,
	icon text not null,
	color text not null,
	is_system boolean not null default false,
	created_at timestamptz not null,
	updated_at timestamptz not null,
	deleted_at timestamptz,
	server_updated_at timestamptz not null default clock_timestamp(),
	primary key (user_id, id)
);

create index if not exists categories_sync_idx on public.categories (user_id, server_updated_at);

drop trigger if exists categories_before_write on public.categories;
create trigger categories_before_write
	before insert or update on public.categories
	for each row execute function public.vb_before_write();

alter table public.categories enable row level security;

drop policy if exists "categories: dono" on public.categories;
create policy "categories: dono" on public.categories
	for all to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

revoke all on public.categories from anon;
grant select, insert, update on public.categories to authenticated;

create table if not exists public.categorization_rules (
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	id uuid not null,
	pattern text not null,
	match_type text not null,
	category_id uuid not null,
	account_id uuid,
	priority integer not null default 0,
	is_system boolean not null default false,
	created_at timestamptz not null,
	updated_at timestamptz not null,
	deleted_at timestamptz,
	server_updated_at timestamptz not null default clock_timestamp(),
	primary key (user_id, id)
);

create index if not exists categorization_rules_sync_idx on public.categorization_rules (user_id, server_updated_at);

drop trigger if exists categorization_rules_before_write on public.categorization_rules;
create trigger categorization_rules_before_write
	before insert or update on public.categorization_rules
	for each row execute function public.vb_before_write();

alter table public.categorization_rules enable row level security;

drop policy if exists "categorization_rules: dono" on public.categorization_rules;
create policy "categorization_rules: dono" on public.categorization_rules
	for all to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

revoke all on public.categorization_rules from anon;
grant select, insert, update on public.categorization_rules to authenticated;

create table if not exists public.transactions (
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	id uuid not null,
	account_id uuid not null,
	date date not null,
	amount_cents bigint not null,
	description text not null,
	notes text not null default '',
	kind text not null,
	category_id uuid,
	transfer_id uuid,
	fit_id text,
	import_batch_id uuid,
	recurring_id uuid,
	created_at timestamptz not null,
	updated_at timestamptz not null,
	deleted_at timestamptz,
	server_updated_at timestamptz not null default clock_timestamp(),
	primary key (user_id, id)
);

create index if not exists transactions_sync_idx on public.transactions (user_id, server_updated_at);

drop trigger if exists transactions_before_write on public.transactions;
create trigger transactions_before_write
	before insert or update on public.transactions
	for each row execute function public.vb_before_write();

alter table public.transactions enable row level security;

drop policy if exists "transactions: dono" on public.transactions;
create policy "transactions: dono" on public.transactions
	for all to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

revoke all on public.transactions from anon;
grant select, insert, update on public.transactions to authenticated;

create table if not exists public.recurring_rules (
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	id uuid not null,
	description text not null,
	account_id uuid not null,
	category_id uuid,
	kind text not null,
	amount_cents bigint not null,
	frequency text not null,
	start_date date not null,
	end_date date,
	next_date date not null,
	active boolean not null default true,
	created_at timestamptz not null,
	updated_at timestamptz not null,
	deleted_at timestamptz,
	server_updated_at timestamptz not null default clock_timestamp(),
	primary key (user_id, id)
);

create index if not exists recurring_rules_sync_idx on public.recurring_rules (user_id, server_updated_at);

drop trigger if exists recurring_rules_before_write on public.recurring_rules;
create trigger recurring_rules_before_write
	before insert or update on public.recurring_rules
	for each row execute function public.vb_before_write();

alter table public.recurring_rules enable row level security;

drop policy if exists "recurring_rules: dono" on public.recurring_rules;
create policy "recurring_rules: dono" on public.recurring_rules
	for all to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

revoke all on public.recurring_rules from anon;
grant select, insert, update on public.recurring_rules to authenticated;

create table if not exists public.import_batches (
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	id uuid not null,
	account_id uuid not null,
	file_name text not null,
	imported_count integer not null default 0,
	skipped_count integer not null default 0,
	period_start date,
	period_end date,
	created_at timestamptz not null,
	updated_at timestamptz not null,
	deleted_at timestamptz,
	server_updated_at timestamptz not null default clock_timestamp(),
	primary key (user_id, id)
);

create index if not exists import_batches_sync_idx on public.import_batches (user_id, server_updated_at);

drop trigger if exists import_batches_before_write on public.import_batches;
create trigger import_batches_before_write
	before insert or update on public.import_batches
	for each row execute function public.vb_before_write();

alter table public.import_batches enable row level security;

drop policy if exists "import_batches: dono" on public.import_batches;
create policy "import_batches: dono" on public.import_batches
	for all to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

revoke all on public.import_batches from anon;
grant select, insert, update on public.import_batches to authenticated;

-- Realtime: avisa os outros aparelhos do mesmo usuário (o RLS filtra as linhas).
do $$
declare
	t text;
begin
	foreach t in array array['account_types', 'accounts', 'categories', 'categorization_rules', 'transactions', 'recurring_rules', 'import_batches']
	loop
		if not exists (
			select 1 from pg_publication_tables
			where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
		) then
			execute format('alter publication supabase_realtime add table public.%I', t);
		end if;
	end loop;
end;
$$;

-- Vida Boa: restrições de domínio e de tamanho (defesa em profundidade).
--
-- O RLS já garante que cada usuário só mexe nas próprias linhas. Estas restrições impedem
-- que um cliente adulterado grave valores que o app não entende ou textos enormes.
-- São NOT VALID: valem para gravações novas sem reprocessar linhas já existentes.
-- Pode rodar de novo sem problema.

do $$
declare
	c record;
begin
	for c in select * from (values
		('account_types', 'account_types_kind_chk', $c$kind in ('checking','savings','credit_card','investment','cash','other')$c$),
		('account_types', 'account_types_name_len_chk', $c$char_length(name) between 1 and 120$c$),
		('accounts', 'accounts_name_len_chk', $c$char_length(name) between 1 and 120$c$),
		('accounts', 'accounts_institution_len_chk', $c$char_length(institution) <= 120$c$),
		('accounts', 'accounts_color_fmt_chk', $c$color ~ '^#[0-9a-fA-F]{6}$'$c$),
		('accounts', 'accounts_currency_chk', $c$currency = 'BRL'$c$),
		('accounts', 'accounts_ofx_len_chk', $c$char_length(coalesce(ofx_bank_id,'')) <= 64 and char_length(coalesce(ofx_account_id,'')) <= 64$c$),
		('categories', 'categories_kind_chk', $c$kind in ('expense','income')$c$),
		('categories', 'categories_name_len_chk', $c$char_length(name) between 1 and 120$c$),
		('categories', 'categories_icon_len_chk', $c$char_length(icon) <= 40$c$),
		('categories', 'categories_color_fmt_chk', $c$color ~ '^#[0-9a-fA-F]{6}$'$c$),
		('categorization_rules', 'categorization_rules_match_type_chk', $c$match_type in ('contains','starts_with','equals')$c$),
		('categorization_rules', 'categorization_rules_pattern_len_chk', $c$char_length(pattern) between 1 and 300$c$),
		('categorization_rules', 'categorization_rules_priority_range_chk', $c$priority between -1000 and 1000$c$),
		('transactions', 'transactions_kind_chk', $c$kind in ('expense','income','transfer')$c$),
		('transactions', 'transactions_description_len_chk', $c$char_length(description) <= 1000$c$),
		('transactions', 'transactions_notes_len_chk', $c$char_length(notes) <= 5000$c$),
		('transactions', 'transactions_fit_id_len_chk', $c$char_length(coalesce(fit_id,'')) <= 255$c$),
		('transactions', 'transactions_amount_range_chk', $c$abs(amount_cents) < 1000000000000$c$),
		('recurring_rules', 'recurring_rules_kind_chk', $c$kind in ('expense','income')$c$),
		('recurring_rules', 'recurring_rules_frequency_chk', $c$frequency in ('weekly','monthly','yearly')$c$),
		('recurring_rules', 'recurring_rules_description_len_chk', $c$char_length(description) between 1 and 1000$c$),
		('recurring_rules', 'recurring_rules_amount_range_chk', $c$amount_cents >= 0 and amount_cents < 1000000000000$c$),
		('import_batches', 'import_batches_file_name_len_chk', $c$char_length(file_name) <= 255$c$),
		('import_batches', 'import_batches_counts_chk', $c$imported_count >= 0 and skipped_count >= 0$c$)
	) as v(tbl, con, expr)
	loop
		if not exists (select 1 from pg_constraint where conname = c.con) then
			execute format('alter table public.%I add constraint %I check (%s) not valid', c.tbl, c.con, c.expr);
		end if;
	end loop;
end;
$$;

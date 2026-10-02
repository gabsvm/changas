-- Security and performance follow-ups from the Supabase advisors.
--
-- 1. Trigger functions are never meant to be called through the API; remove the
--    implicit EXECUTE grant that exposed them to anon/authenticated (triggers
--    keep firing: EXECUTE is only checked when a trigger is created).
-- 2. RLS policies that call auth.uid() directly re-evaluate it per row. Wrapping
--    it in a scalar subquery lets Postgres evaluate it once per statement
--    (advisor 0003_auth_rls_initplan). Behaviour is unchanged.

revoke execute on function public.capture_payment_settlement_from_ledger()
from public, anon, authenticated;
revoke execute on function public.initialize_job_schedule()
from public, anon, authenticated;

do $$
declare
  policy_row record;
  new_using text;
  new_check text;
  statement text;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~* '(?<!select )auth\.uid\(\)'
        or coalesce(with_check, '') ~* '(?<!select )auth\.uid\(\)'
      )
  loop
    new_using := case
      when policy_row.qual is null then null
      else regexp_replace(
        policy_row.qual, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'gi'
      )
    end;
    new_check := case
      when policy_row.with_check is null then null
      else regexp_replace(
        policy_row.with_check, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'gi'
      )
    end;

    statement := format(
      'alter policy %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
    if new_using is not null then
      statement := statement || format(' using (%s)', new_using);
    end if;
    if new_check is not null then
      statement := statement || format(' with check (%s)', new_check);
    end if;

    execute statement;
  end loop;
end
$$;

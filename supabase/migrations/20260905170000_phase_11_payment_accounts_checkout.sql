-- Phase 11: provider payment accounts and durable hosted-checkout orchestration.
-- Sensitive seller credentials are server-only and stored as independent
-- authenticated-encryption envelopes. Redirect/checkout state is not financial truth.

create type public.payment_provider_account_status as enum (
  'CONNECTED',
  'REAUTH_REQUIRED',
  'DISCONNECTED',
  'SUSPENDED'
);

create type public.payment_checkout_purpose as enum (
  'PROPOSAL',
  'SCOPE_CHANGE'
);

create type public.payment_checkout_status as enum (
  'CREATED',
  'REDIRECT_READY',
  'COMPLETED',
  'EXPIRED',
  'FAILED'
);

create table public.payment_provider_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  provider_name text not null,
  provider_account_reference text not null,
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_auth_tag text not null,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_auth_tag text not null,
  encryption_key_version integer not null check (encryption_key_version > 0),
  scope text,
  token_expires_at timestamptz,
  status public.payment_provider_account_status not null default 'CONNECTED',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(provider_name)) between 2 and 80),
  check (char_length(btrim(provider_account_reference)) between 2 and 160),
  check (char_length(access_token_ciphertext) between 8 and 12000),
  check (char_length(access_token_iv) between 8 and 256),
  check (char_length(access_token_auth_tag) between 8 and 256),
  check (char_length(refresh_token_ciphertext) between 8 and 12000),
  check (char_length(refresh_token_iv) between 8 and 256),
  check (char_length(refresh_token_auth_tag) between 8 and 256),
  check (scope is null or char_length(scope) <= 4000),
  unique (provider_user_id, provider_name),
  unique (provider_name, provider_account_reference)
);

create trigger payment_provider_accounts_set_updated_at
before update on public.payment_provider_accounts
for each row execute function public.set_updated_at();

create table public.payment_checkout_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  request_nonce uuid not null unique,
  purpose public.payment_checkout_purpose not null,
  proposal_id uuid references public.proposals(id) on delete restrict,
  scope_change_id uuid references public.job_scope_changes(id) on delete restrict,
  client_user_id uuid not null references auth.users(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  payment_provider_account_id uuid not null references public.payment_provider_accounts(id) on delete restrict,
  provider_name text not null,
  provider_checkout_reference text,
  external_reference text not null,
  amount_minor bigint not null check (amount_minor > 0),
  marketplace_fee_minor bigint not null check (marketplace_fee_minor >= 0),
  provider_net_expected_minor bigint not null check (provider_net_expected_minor >= 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  status public.payment_checkout_status not null default 'CREATED',
  checkout_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (client_user_id <> provider_user_id),
  check (char_length(btrim(provider_name)) between 2 and 80),
  check (char_length(btrim(external_reference)) between 6 and 200),
  check (
    provider_checkout_reference is null
    or char_length(btrim(provider_checkout_reference)) between 2 and 200
  ),
  check (checkout_url is null or char_length(checkout_url) between 8 and 4000),
  check (marketplace_fee_minor <= amount_minor),
  check (provider_net_expected_minor + marketplace_fee_minor = amount_minor),
  check (
    (purpose = 'PROPOSAL' and proposal_id is not null and scope_change_id is null)
    or
    (purpose = 'SCOPE_CHANGE' and proposal_id is null and scope_change_id is not null)
  )
);

create unique index payment_checkout_sessions_provider_reference_uidx
on public.payment_checkout_sessions (provider_name, provider_checkout_reference)
where provider_checkout_reference is not null;

create unique index payment_checkout_sessions_external_reference_uidx
on public.payment_checkout_sessions (external_reference);

create index payment_checkout_sessions_proposal_idx
on public.payment_checkout_sessions (proposal_id)
where proposal_id is not null;

create index payment_checkout_sessions_scope_change_idx
on public.payment_checkout_sessions (scope_change_id)
where scope_change_id is not null;

create index payment_checkout_sessions_client_created_idx
on public.payment_checkout_sessions (client_user_id, created_at desc, id desc);

create index payment_checkout_sessions_provider_created_idx
on public.payment_checkout_sessions (provider_user_id, created_at desc, id desc);

create trigger payment_checkout_sessions_set_updated_at
before update on public.payment_checkout_sessions
for each row execute function public.set_updated_at();

alter table public.payment_provider_accounts enable row level security;
alter table public.payment_checkout_sessions enable row level security;

revoke all privileges on table public.payment_provider_accounts from public, anon, authenticated, service_role;
revoke all privileges on table public.payment_checkout_sessions from public, anon, authenticated, service_role;

grant select on table public.payment_provider_accounts to service_role;
grant select, insert, update on table public.payment_checkout_sessions to service_role;

create or replace function public.get_my_payment_provider_account_state()
returns table (
  id uuid,
  provider_name text,
  provider_account_reference text,
  status public.payment_provider_account_status,
  token_expires_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    account.id,
    account.provider_name,
    account.provider_account_reference,
    account.status,
    account.token_expires_at,
    account.updated_at
  from public.payment_provider_accounts account
  where account.provider_user_id = auth.uid()
  order by account.provider_name, account.id;
$$;

revoke all on function public.get_my_payment_provider_account_state()
from public, anon, authenticated, service_role;
grant execute on function public.get_my_payment_provider_account_state()
to authenticated, service_role;

create or replace function public.upsert_payment_provider_account(
  target_provider_user_id uuid,
  payment_provider_name text,
  payment_provider_account_reference text,
  encrypted_access_token_ciphertext text,
  encrypted_access_token_iv text,
  encrypted_access_token_auth_tag text,
  encrypted_refresh_token_ciphertext text,
  encrypted_refresh_token_iv text,
  encrypted_refresh_token_auth_tag text,
  token_encryption_key_version integer,
  granted_scope text,
  access_token_expires_at timestamptz,
  account_status public.payment_provider_account_status default 'CONNECTED'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_provider_name text := upper(btrim(payment_provider_name));
  normalized_account_reference text := btrim(payment_provider_account_reference);
  normalized_scope text := nullif(btrim(granted_scope), '');
  account_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment provider account mutation is server-only';
  end if;

  if target_provider_user_id is null then
    raise exception using errcode = '22023', message = 'provider user id is required';
  end if;

  if normalized_provider_name is null
    or char_length(normalized_provider_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'payment provider name is invalid';
  end if;

  if normalized_account_reference is null
    or char_length(normalized_account_reference) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'payment provider account reference is invalid';
  end if;

  if token_encryption_key_version is null or token_encryption_key_version <= 0 then
    raise exception using errcode = '22023', message = 'token encryption key version is invalid';
  end if;

  if char_length(coalesce(encrypted_access_token_ciphertext, '')) not between 8 and 12000
    or char_length(coalesce(encrypted_access_token_iv, '')) not between 8 and 256
    or char_length(coalesce(encrypted_access_token_auth_tag, '')) not between 8 and 256
    or char_length(coalesce(encrypted_refresh_token_ciphertext, '')) not between 8 and 12000
    or char_length(coalesce(encrypted_refresh_token_iv, '')) not between 8 and 256
    or char_length(coalesce(encrypted_refresh_token_auth_tag, '')) not between 8 and 256 then
    raise exception using errcode = '22023', message = 'encrypted seller token envelope is invalid';
  end if;

  insert into public.payment_provider_accounts (
    provider_user_id,
    provider_name,
    provider_account_reference,
    access_token_ciphertext,
    access_token_iv,
    access_token_auth_tag,
    refresh_token_ciphertext,
    refresh_token_iv,
    refresh_token_auth_tag,
    encryption_key_version,
    scope,
    token_expires_at,
    status
  ) values (
    target_provider_user_id,
    normalized_provider_name,
    normalized_account_reference,
    encrypted_access_token_ciphertext,
    encrypted_access_token_iv,
    encrypted_access_token_auth_tag,
    encrypted_refresh_token_ciphertext,
    encrypted_refresh_token_iv,
    encrypted_refresh_token_auth_tag,
    token_encryption_key_version,
    normalized_scope,
    access_token_expires_at,
    account_status
  )
  on conflict (provider_user_id, provider_name)
  do update set
    provider_account_reference = excluded.provider_account_reference,
    access_token_ciphertext = excluded.access_token_ciphertext,
    access_token_iv = excluded.access_token_iv,
    access_token_auth_tag = excluded.access_token_auth_tag,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    refresh_token_iv = excluded.refresh_token_iv,
    refresh_token_auth_tag = excluded.refresh_token_auth_tag,
    encryption_key_version = excluded.encryption_key_version,
    scope = excluded.scope,
    token_expires_at = excluded.token_expires_at,
    status = excluded.status
  returning id into account_id;

  return account_id;
end;
$$;

revoke all on function public.upsert_payment_provider_account(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  timestamptz,
  public.payment_provider_account_status
) from public, anon, authenticated, service_role;

grant execute on function public.upsert_payment_provider_account(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  timestamptz,
  public.payment_provider_account_status
) to service_role;

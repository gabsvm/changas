-- YALO B3: paginación real de /jobs sin falsos vacíos + conteo agregado de no leídos.
--
-- Problema 1: /jobs recortaba a 20/50 ANTES de filtrar por estado en el
-- cliente (falsos vacíos con 55+ trabajos multi-estado). Fix append-only:
--   * list_my_upcoming_jobs / list_my_past_jobs ganan parámetros opcionales
--     status_filter + cursor keyset (before_*), con defaults para que las
--     llamadas viejas (solo limit_count) sigan funcionando.
--   * El filtro vive en SQL: upcoming acepta CONFIRMED | IN_PROGRESS |
--     CLOSING; past acepta PENDING_SETTLEMENT (settlement DUE). Valor
--     desconocido o null = sin filtro (nunca vacío falso por typo).
--   * upcoming ordena por coalesce(starts, deadline, confirmed, updated_at):
--     el updated_at de fallback evita sort keys NULL para que el cursor sea
--     exacto; solo cambia el orden de filas patológicas sin fecha alguna.
-- Problema 2: getUnreadConversationCount solo miraba las primeras 20
-- conversaciones. Nuevo agregado get_my_unread_conversation_count con la
-- misma lógica de no leídos que list_my_conversations (respeta
-- participación client/provider, SECURITY DEFINER como sus hermanas).
-- El server TS usa el agregado con fallback al conteo anterior si el RPC
-- aún no existe (deploy ordering).
-- Sin push a prod (runbook manual).

drop function if exists public.list_my_upcoming_jobs(integer);

create or replace function public.list_my_upcoming_jobs(
  limit_count integer default 20,
  status_filter text default null,
  before_sort_key timestamptz default null,
  before_id uuid default null
)
returns table (
  job_id uuid,
  job_status public.job_status,
  service_title text,
  counterparty_name text,
  schedule_type public.schedule_type,
  starts_at timestamptz,
  ends_at timestamptz,
  deadline_at timestamptz,
  updated_at timestamptz,
  base_price_amount bigint,
  currency_code text,
  is_client boolean,
  paid_additional_amount bigint,
  total_price_amount bigint,
  sort_key timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  bounded_limit integer := least(greatest(coalesce(limit_count, 20), 1), 50);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  select
    j.id,
    j.status,
    pv.service_title_snapshot,
    coalesce(peer.display_name, 'Usuario'),
    sv.schedule_type,
    sv.starts_at,
    sv.ends_at,
    sv.deadline_at,
    j.updated_at,
    pv.price_amount,
    pv.currency_code,
    caller_id = j.client_user_id,
    public.paid_scope_additional_for_job(j.id),
    pv.price_amount + public.paid_scope_additional_for_job(j.id),
    coalesce(sv.starts_at, sv.deadline_at, j.confirmed_at, j.updated_at)
  from public.jobs j
  join public.proposal_versions pv on pv.id = j.accepted_proposal_version_id
  left join public.job_schedule_versions sv on sv.id = j.current_schedule_version_id
  left join public.profiles peer on peer.id = case
    when caller_id = j.client_user_id then j.provider_user_id
    else j.client_user_id
  end
  where caller_id in (j.client_user_id, j.provider_user_id)
    and j.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED', 'DISPUTED')
    and (
      status_filter is null
      or status_filter not in ('CONFIRMED', 'IN_PROGRESS', 'CLOSING')
      or (status_filter = 'CONFIRMED' and j.status = 'CONFIRMED')
      or (status_filter = 'IN_PROGRESS' and j.status = 'IN_PROGRESS')
      or (status_filter = 'CLOSING' and j.status in ('COMPLETION_REQUESTED', 'DISPUTED'))
    )
    and (
      before_sort_key is null
      or coalesce(sv.starts_at, sv.deadline_at, j.confirmed_at, j.updated_at) > before_sort_key
      or (
        coalesce(sv.starts_at, sv.deadline_at, j.confirmed_at, j.updated_at) = before_sort_key
        and before_id is not null
        and j.id > before_id
      )
    )
  order by coalesce(sv.starts_at, sv.deadline_at, j.confirmed_at, j.updated_at) asc, j.id asc
  limit bounded_limit;
end;
$$;

revoke all on function public.list_my_upcoming_jobs(integer, text, timestamptz, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_my_upcoming_jobs(integer, text, timestamptz, uuid)
to authenticated, service_role;

drop function if exists public.list_my_past_jobs(integer);

create or replace function public.list_my_past_jobs(
  limit_count integer default 20,
  status_filter text default null,
  before_updated_at timestamptz default null,
  before_id uuid default null
)
returns table (
  job_id uuid,
  job_status public.job_status,
  service_title text,
  counterparty_name text,
  schedule_type public.schedule_type,
  starts_at timestamptz,
  ends_at timestamptz,
  deadline_at timestamptz,
  updated_at timestamptz,
  base_price_amount bigint,
  currency_code text,
  is_client boolean,
  paid_additional_amount bigint,
  total_price_amount bigint,
  settlement_status text,
  settlement_total_minor bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  bounded_limit integer := least(greatest(coalesce(limit_count, 20), 1), 50);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  select
    j.id,
    j.status,
    pv.service_title_snapshot,
    coalesce(peer.display_name, 'Usuario'),
    sv.schedule_type,
    sv.starts_at,
    sv.ends_at,
    sv.deadline_at,
    j.updated_at,
    pv.price_amount,
    pv.currency_code,
    caller_id = j.client_user_id,
    public.paid_scope_additional_for_job(j.id),
    pv.price_amount + public.paid_scope_additional_for_job(j.id),
    case
      when j.status <> 'COMPLETED' then 'NOT_DUE'
      when public.job_is_settled(j.id) then 'SETTLED'
      when coalesce(pv.price_amount, 0) + public.unpaid_scope_additional_for_job(j.id) <= 0 then 'NOT_REQUIRED'
      else 'DUE'
    end,
    coalesce(pv.price_amount, 0) + public.unpaid_scope_additional_for_job(j.id)
  from public.jobs j
  join public.proposal_versions pv on pv.id = j.accepted_proposal_version_id
  left join public.job_schedule_versions sv on sv.id = j.current_schedule_version_id
  left join public.profiles peer on peer.id = case
    when caller_id = j.client_user_id then j.provider_user_id
    else j.client_user_id
  end
  where caller_id in (j.client_user_id, j.provider_user_id)
    and j.status in ('COMPLETED', 'CANCELLED', 'NO_SHOW')
    and (
      status_filter is null
      or status_filter <> 'PENDING_SETTLEMENT'
      or (
        j.status = 'COMPLETED'
        and not public.job_is_settled(j.id)
        and coalesce(pv.price_amount, 0) + public.unpaid_scope_additional_for_job(j.id) > 0
      )
    )
    and (
      before_updated_at is null
      or j.updated_at < before_updated_at
      or (j.updated_at = before_updated_at and before_id is not null and j.id < before_id)
    )
  order by j.updated_at desc, j.id desc
  limit bounded_limit;
end;
$$;

revoke all on function public.list_my_past_jobs(integer, text, timestamptz, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_my_past_jobs(integer, text, timestamptz, uuid)
to authenticated, service_role;

-- Agregado de conversaciones no leídas: misma definición de "no leído" que
-- list_my_conversations (mensajes ajenos posteriores al cursor de lectura).
create or replace function public.get_my_unread_conversation_count()
returns bigint
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  unread_total bigint;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select count(*) into unread_total
  from public.conversations conversation
  left join public.conversation_reads reads
    on reads.conversation_id = conversation.id
   and reads.user_id = caller_id
  left join public.messages read_message
    on read_message.id = reads.last_read_message_id
  where (conversation.client_user_id = caller_id or conversation.provider_user_id = caller_id)
    and exists (
      select 1
      from public.messages message
      where message.conversation_id = conversation.id
        and (message.sender_user_id is null or message.sender_user_id <> caller_id)
        and (
          reads.last_read_message_id is null
          or (message.created_at, message.id) > (read_message.created_at, read_message.id)
        )
    );

  return coalesce(unread_total, 0);
end;
$$;

revoke all on function public.get_my_unread_conversation_count()
from public, anon, authenticated, service_role;
grant execute on function public.get_my_unread_conversation_count()
to authenticated, service_role;

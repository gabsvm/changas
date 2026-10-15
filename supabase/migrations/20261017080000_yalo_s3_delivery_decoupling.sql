-- YALO S3: entrega desacoplada (SPEC 6A/6B/6C).
-- El PIN deja de ser el pedido de revision: el prestador primero envia la
-- entrega (sin codigo), el cliente revisa y comparte el PIN solo si
-- corresponde, y la confirmacion final sigue siendo un acto separado del
-- cliente. Remoto nunca pide PIN. Append-only; no toca datos existentes.

alter table public.jobs
  add column if not exists effective_modality public.service_modality null
    check (effective_modality in ('IN_PERSON', 'REMOTE')),
  add column if not exists delivery_submitted_at timestamptz null,
  add column if not exists delivery_evidence_url text null
    check (delivery_evidence_url is null or char_length(delivery_evidence_url) <= 2048),
  add column if not exists delivery_summary text null
    check (delivery_summary is null or char_length(btrim(delivery_summary)) between 3 and 2000),
  add column if not exists handover_verified_at timestamptz null,
  add column if not exists correction_count integer not null default 0;

comment on column public.jobs.delivery_submitted_at is 'Provider submitted the delivery for review (no code involved).';
comment on column public.jobs.handover_verified_at is 'In-person handover constancy via client PIN; never final acceptance.';
comment on column public.jobs.correction_count is 'Client correction rounds; history stays in job_events.';

-- Enviar la entrega para revision (sin codigo). En remoto mueve directo a
-- COMPLETION_REQUESTED; en presencial queda IN_PROGRESS hasta verificar el
-- PIN por request_job_completion.
create or replace function public.submit_job_delivery(
  target_job_id uuid,
  delivery_summary text,
  delivery_evidence_url text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  job_modality public.service_modality;
  target_conversation public.conversations%rowtype;
  event_time timestamptz := timezone('utc', now());
  clean_summary text := nullif(btrim(coalesce(delivery_summary, '')), '');
  clean_evidence_url text := nullif(btrim(coalesce(delivery_evidence_url, '')), '');
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_job_id::text, 0));

  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null or caller_id not in (target_job.client_user_id, target_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  if target_job.status <> 'IN_PROGRESS' then
    raise exception using errcode = '40001', message = 'job state changed; refresh and retry';
  end if;

  if caller_id <> target_job.provider_user_id then
    raise exception using errcode = '42501', message = 'only the provider submits the delivery';
  end if;

  if clean_summary is null or char_length(clean_summary) < 3 or char_length(clean_summary) > 2000 then
    raise exception using errcode = '22023', message = 'delivery summary is invalid';
  end if;

  select coalesce(target_job.effective_modality, pv.modality) into job_modality
  from public.proposal_versions pv
  where pv.id = target_job.accepted_proposal_version_id;

  if job_modality is null then
    raise exception using errcode = 'P0002', message = 'agreed terms not found';
  end if;
  if job_modality = 'BOTH' then
    raise exception using errcode = '22023', message = 'choose effective work modality before delivery';
  end if;

  if job_modality = 'REMOTE' and (
    clean_evidence_url is null
    or clean_evidence_url !~* '^https://[^[:space:]<>]+$'
    or clean_evidence_url ~* '^https://([^/]+@|localhost([:/]|$)|127[.]|10[.]|192[.]168[.])'
  ) then
    raise exception using errcode = '22023',
      message = 'remote delivery requires a valid HTTPS evidence link';
  end if;

  update public.jobs
  set delivery_submitted_at = event_time,
      delivery_summary = clean_summary,
      delivery_evidence_url = case when job_modality = 'REMOTE' then clean_evidence_url else null end,
      status = case when job_modality = 'REMOTE' then 'COMPLETION_REQUESTED'::public.job_status else status end,
      completion_requested_at = case when job_modality = 'REMOTE' then event_time else completion_requested_at end,
      updated_at = event_time
  where id = target_job_id;

  insert into public.job_events (
    job_id, actor_user_id, event_type, from_status, to_status, reason, created_at
  ) values (
    target_job_id, caller_id, 'JOB_DELIVERY_SUBMITTED',
    'IN_PROGRESS',
    case when job_modality = 'REMOTE' then 'COMPLETION_REQUESTED'::public.job_status else 'IN_PROGRESS'::public.job_status end,
    clean_summary, event_time
  );

  select * into target_conversation
  from public.conversations
  where id = target_job.conversation_id;

  if target_conversation.id is not null
    and target_conversation.status = 'OPEN'
    and not exists (
      select 1 from public.user_blocks
      where conversation_id = target_job.conversation_id
    ) then
    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (
      target_job.conversation_id, null, 'SYSTEM',
      case when job_modality = 'REMOTE'
        then 'El proveedor envió la entrega para revisión.'
        else 'El prestador dice que terminó. Revisá el resultado antes de compartir el PIN.'
      end,
      event_time
    );

    update public.conversations set last_message_at = event_time, updated_at = event_time
    where id = target_job.conversation_id;
  end if;

  return 'SUBMITTED';
end;
$$;

revoke all on function public.submit_job_delivery(uuid, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.submit_job_delivery(uuid, text, text)
to authenticated, service_role;

-- Para servicios ofertados como BOTH, el cliente fija la modalidad
-- operativa efectiva antes de entregar. El prestador ya autorizo ambas.
-- La decision queda en el trabajo y no altera el servicio original.
create or replace function public.choose_job_effective_modality(
  target_job_id uuid,
  requested_modality public.service_modality
)
returns public.service_modality
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  published_modality public.service_modality;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if requested_modality not in ('IN_PERSON', 'REMOTE') then
    raise exception using errcode = '22023', message = 'choose in-person or remote modality';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_job_id::text, 0));
  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null or target_job.client_user_id <> caller_id then
    raise exception using errcode = '42501', message = 'only the client chooses work modality';
  end if;
  if target_job.status not in ('CONFIRMED', 'IN_PROGRESS')
    or target_job.delivery_submitted_at is not null then
    raise exception using errcode = '40001', message = 'work modality can no longer change';
  end if;
  select pv.modality into published_modality
  from public.proposal_versions pv
  where pv.id = target_job.accepted_proposal_version_id;
  if published_modality <> 'BOTH' then
    raise exception using errcode = '22023', message = 'work modality is already fixed by the agreement';
  end if;
  if target_job.effective_modality is not null
    and target_job.effective_modality <> requested_modality then
    raise exception using errcode = '40001', message = 'work modality is already selected';
  end if;
  update public.jobs set effective_modality = requested_modality,
    updated_at = timezone('utc', now()) where id = target_job_id;
  insert into public.job_events(job_id, actor_user_id, event_type, reason, created_at)
  values (target_job_id, caller_id, 'JOB_MODALITY_CHOSEN',
    requested_modality::text, timezone('utc', now()));
  return requested_modality;
end;
$$;

revoke all on function public.choose_job_effective_modality(uuid, public.service_modality)
from public, anon, authenticated, service_role;
grant execute on function public.choose_job_effective_modality(uuid, public.service_modality)
to authenticated, service_role;

-- Pedir correccion: el cliente devuelve el trabajo a IN_PROGRESS con
-- motivo. El historial queda en eventos; tope anti-loop con via a disputa.
create or replace function public.request_job_correction(
  target_job_id uuid,
  correction_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  target_conversation public.conversations%rowtype;
  event_time timestamptz := timezone('utc', now());
  clean_reason text := nullif(btrim(coalesce(correction_reason, '')), '');
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_job_id::text, 0));

  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null or caller_id not in (target_job.client_user_id, target_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  if target_job.status <> 'COMPLETION_REQUESTED' then
    raise exception using errcode = '40001', message = 'job state changed; refresh and retry';
  end if;

  if caller_id <> target_job.client_user_id then
    raise exception using errcode = '42501', message = 'only the client requests a correction';
  end if;

  if clean_reason is null or char_length(clean_reason) > 1000 then
    raise exception using errcode = '22023', message = 'correction reason is invalid';
  end if;

  if coalesce(target_job.correction_count, 0) >= 5 then
    raise exception using errcode = '22023', message = 'too many corrections; report a problem for mediation';
  end if;

  update public.jobs
  set status = 'IN_PROGRESS',
      completion_requested_at = null,
      delivery_submitted_at = null,
      delivery_summary = null,
      delivery_evidence_url = null,
      handover_verified_at = null,
      correction_count = coalesce(correction_count, 0) + 1,
      updated_at = event_time
  where id = target_job_id;

  insert into public.job_events (
    job_id, actor_user_id, event_type, from_status, to_status, reason, created_at
  ) values (
    target_job_id, caller_id, 'JOB_CORRECTION_REQUESTED',
    'COMPLETION_REQUESTED', 'IN_PROGRESS', clean_reason, event_time
  );

  select * into target_conversation
  from public.conversations
  where id = target_job.conversation_id;

  if target_conversation.id is not null
    and target_conversation.status = 'OPEN'
    and not exists (
      select 1 from public.user_blocks
      where conversation_id = target_job.conversation_id
    ) then
    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (
      target_job.conversation_id, null, 'SYSTEM',
      'El cliente pidió una corrección.',
      event_time
    );

    update public.conversations set last_message_at = event_time, updated_at = event_time
    where id = target_job.conversation_id;
  end if;

  return 'CORRECTION_REQUESTED';
end;
$$;

revoke all on function public.request_job_correction(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.request_job_correction(uuid, text)
to authenticated, service_role;

-- request_job_completion pasa a ser solo verificacion de constancia
-- (handover) tras el envio: exige entrega enviada y rechaza remoto (sin
-- PIN). Copia exacta de la autoridad A1 + compuerta de desacople; el
-- rate-limit y el orden advisory->fila quedan intactos.
create or replace function public.request_job_completion(
  target_job_id uuid,
  confirmation_code text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  target_conversation public.conversations%rowtype;
  job_modality public.service_modality;
  event_time timestamptz := timezone('utc', now());
  normalized_code text := nullif(btrim(coalesce(confirmation_code, '')), '');
  recent_failures integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  -- Orden único advisory→fila en todo el módulo de cierre.
  perform pg_advisory_xact_lock(hashtextextended(target_job_id::text, 0));

  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null or caller_id not in (target_job.client_user_id, target_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  if target_job.status <> 'IN_PROGRESS' then
    raise exception using errcode = '40001', message = 'job state changed; refresh and retry';
  end if;

  if caller_id <> target_job.provider_user_id then
    raise exception using errcode = '42501', message = 'job transition is not allowed for this actor/state';
  end if;

  -- YALO S3: sin entrega enviada no hay constancia que verificar. El PIN
  -- dejo de ser el pedido de revision.
  if target_job.delivery_submitted_at is null then
    raise exception using errcode = '22023', message = 'submit the delivery before verifying the handover code';
  end if;

  select coalesce(target_job.effective_modality, pv.modality) into job_modality
  from public.proposal_versions pv
  where pv.id = target_job.accepted_proposal_version_id;

  if target_job.confirmation_code is null then
    -- Sin código no hay secreto que adivinar: transición directa con los
    -- mismos efectos (rol y estado ya validados bajo lock).
    update public.jobs
    set status = 'COMPLETION_REQUESTED',
        handover_verified_at = event_time,
        updated_at = event_time,
        completion_requested_at = event_time
    where id = target_job_id;

    insert into public.job_events (
      job_id, actor_user_id, event_type, from_status, to_status, reason, created_at
    ) values (
      target_job_id, caller_id, 'JOB_HANDOVER_VERIFIED',
      'IN_PROGRESS', 'COMPLETION_REQUESTED', null, event_time
    );

    select * into target_conversation
    from public.conversations
    where id = target_job.conversation_id;

    if target_conversation.id is not null
      and target_conversation.status = 'OPEN'
      and not exists (
        select 1 from public.user_blocks
        where conversation_id = target_job.conversation_id
      ) then
      insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
      values (
        target_job.conversation_id, null, 'SYSTEM',
        'Se dejó constancia de la entrega presencial.', event_time
      );

      update public.conversations set last_message_at = event_time, updated_at = event_time
      where id = target_job.conversation_id;
    end if;

    return 'COMPLETED';
  end if;

  if normalized_code is null then
    raise exception using errcode = '22023', message = 'confirmation code is required to request completion';
  end if;

  select count(*) into recent_failures
  from public.job_confirmation_code_attempts
  where job_id = target_job_id
    and created_at > event_time - interval '10 minutes';
  if recent_failures >= 5 then
    return 'LOCKED';
  end if;

  if normalized_code <> target_job.confirmation_code then
    -- Sin RAISE a propósito: la excepción revertiría este INSERT y el
    -- fallo nunca persistiría (bug P1-01 original). El llamante mapea
    -- 'MISMATCH' al mensaje de UX. El rate-limit queda observable en
    -- cualquier modalidad; el rechazo remoto vive solo en el camino de
    -- exito (tras el codigo correcto), asi el conteo de intentos no
    -- cambia de semantica.
    insert into public.job_confirmation_code_attempts (job_id, attempted_by_user_id)
    values (target_job_id, caller_id);
    return 'MISMATCH';
  end if;

  if job_modality = 'REMOTE' then
    raise exception using errcode = '22023', message = 'remote delivery needs no code; review the delivery instead';
  end if;

  delete from public.job_confirmation_code_attempts where job_id = target_job_id;

  update public.jobs
  set status = 'COMPLETION_REQUESTED',
      handover_verified_at = event_time,
      updated_at = event_time,
      completion_requested_at = event_time
  where id = target_job_id;

  insert into public.job_events (
    job_id, actor_user_id, event_type, from_status, to_status, reason, created_at
  ) values (
    target_job_id, caller_id, 'JOB_HANDOVER_VERIFIED',
    'IN_PROGRESS', 'COMPLETION_REQUESTED', null, event_time
  );

  select * into target_conversation
  from public.conversations
  where id = target_job.conversation_id;

  if target_conversation.id is not null
    and target_conversation.status = 'OPEN'
    and not exists (
      select 1 from public.user_blocks
      where conversation_id = target_job.conversation_id
    ) then
    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (
      target_job.conversation_id, null, 'SYSTEM',
      'Se dejó constancia de la entrega presencial.', event_time
    );

    update public.conversations set last_message_at = event_time, updated_at = event_time
    where id = target_job.conversation_id;
  end if;

  return 'COMPLETED';
end;
$$;

revoke all on function public.request_job_completion(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.request_job_completion(uuid, text)
to authenticated, service_role;

-- Confirmacion final exige evidencia: entrega enviada siempre; constancia
-- PIN cuando la modalidad no es remota. Un solo punto de control para la
-- confirmacion manual y el autocierre.
create or replace function public.require_completion_evidence()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  job_modality public.service_modality;
begin
  if NEW.status = 'COMPLETED' and OLD.status = 'COMPLETION_REQUESTED' then
    if NEW.delivery_submitted_at is null then
      raise exception using errcode = '22023', message = 'delivery evidence is required before completion';
    end if;

    select coalesce(NEW.effective_modality, pv.modality) into job_modality
    from public.proposal_versions pv
    where pv.id = NEW.accepted_proposal_version_id;

    if job_modality = 'REMOTE' and NEW.delivery_evidence_url is null then
      raise exception using errcode = '22023', message = 'remote delivery link is required';
    end if;

    if job_modality is distinct from 'REMOTE' and NEW.handover_verified_at is null then
      raise exception using errcode = '22023', message = 'handover verification is required before final confirmation';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists require_completion_evidence_trigger on public.jobs;

create trigger require_completion_evidence_trigger
before update on public.jobs
for each row execute function public.require_completion_evidence();

-- Autocierre con evidencia (SPEC 6C): solo con entrega enviada; en
-- presencial tambien con constancia PIN. Sin prueba no hay cierre por mero
-- paso del tiempo. Claim atomico y revalidacion bajo lock intactos.
create or replace function public.auto_complete_stale_jobs()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  completed_count integer := 0;
  stale_job record;
  cutoff timestamptz := timezone('utc', now());
begin
  -- Claim atómico: FOR UPDATE SKIP LOCKED evita que dos workers tomen el
  -- mismo job; la evidencia se verifica al reclamar bajo el lock (que se
  -- conserva hasta el commit), y el UPDATE revalida estado + reloj, así
  -- una CANCELLED/DISPUTED/CORRECTION concurrente gana y el cron nunca
  -- la sobrescribe. Evento y mensaje solo si el claim afectó 1 fila.
  for stale_job in
    select j.id, j.conversation_id
    from public.jobs j
    join public.proposal_versions pv on pv.id = j.accepted_proposal_version_id
    where j.status = 'COMPLETION_REQUESTED'
      and coalesce(j.completion_requested_at, j.updated_at) < cutoff - interval '7 days'
      and j.delivery_submitted_at is not null
      -- No autocerrar remotos sin revision humana: URL no prueba entrega real.
      and coalesce(j.effective_modality, pv.modality) = 'IN_PERSON'
      and j.handover_verified_at is not null
    order by coalesce(j.completion_requested_at, j.updated_at)
    limit 500
    for update of j skip locked
  loop
    update public.jobs
    set status = 'COMPLETED', updated_at = cutoff
    where id = stale_job.id
      and status = 'COMPLETION_REQUESTED'
      and coalesce(completion_requested_at, updated_at) < cutoff - interval '7 days';

    if not found then
      continue;
    end if;

    insert into public.job_events (job_id, actor_user_id, event_type, from_status, to_status, created_at)
    values (stale_job.id, null, 'JOB_AUTO_COMPLETED', 'COMPLETION_REQUESTED', 'COMPLETED', cutoff);

    if stale_job.conversation_id is not null then
      insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
      values (stale_job.conversation_id, null, 'SYSTEM', 'Trabajo confirmado automáticamente por falta de respuesta.', cutoff);

      update public.conversations
      set last_message_at = cutoff, updated_at = cutoff
      where id = stale_job.conversation_id;
    end if;

    completed_count := completed_count + 1;
  end loop;

  return completed_count;
end;
$$;

revoke all on function public.auto_complete_stale_jobs()
from public, anon, authenticated, service_role;

-- get_job_detail expone el estado de entrega (DROP requerido: cambia el
-- tipo de retorno). Copia exacta de la version lote-AB + 4 columnas al
-- final; ninguna existente cambia de semantica.
drop function if exists public.get_job_detail(uuid);

create or replace function public.get_job_detail(target_job_id uuid)
returns table (
  job_id uuid,
  conversation_id uuid,
  job_status public.job_status,
  client_user_id uuid,
  provider_user_id uuid,
  service_id uuid,
  service_title text,
  scope_snapshot text,
  base_price_amount bigint,
  currency_code text,
  modality public.service_modality,
  schedule_type public.schedule_type,
  schedule_starts_at timestamptz,
  schedule_ends_at timestamptz,
  schedule_deadline_at timestamptz,
  expected_duration_minutes integer,
  counterparty_name text,
  exact_address text,
  exact_latitude double precision,
  exact_longitude double precision,
  access_notes text,
  confirmed_at timestamptz,
  updated_at timestamptz,
  completion_requested_at timestamptz,
  paid_additional_amount bigint,
  total_price_amount bigint,
  settlement_status text,
  settlement_total_minor bigint,
  settlement_unpaid_extras_minor bigint,
  settlement_unpaid_extra_ids uuid[],
  confirmation_code text,
  settled_amount_minor bigint,
  delivery_submitted_at timestamptz,
  delivery_summary text,
  delivery_evidence_url text,
  handover_verified_at timestamptz,
  correction_count integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not exists (
    select 1
    from public.jobs j
    where j.id = target_job_id
      and caller_id in (j.client_user_id, j.provider_user_id)
  ) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  return query
  select
    j.id,
    j.conversation_id,
    j.status,
    j.client_user_id,
    j.provider_user_id,
    j.service_id,
    pv.service_title_snapshot,
    pv.scope_snapshot,
    pv.price_amount,
    pv.currency_code,
    coalesce(j.effective_modality, pv.modality),
    sv.schedule_type,
    sv.starts_at,
    sv.ends_at,
    sv.deadline_at,
    sv.expected_duration_minutes,
    coalesce(peer.display_name, 'Usuario'),
    case when public.can_view_job_exact_location(j.id) then loc.exact_address end,
    case when public.can_view_job_exact_location(j.id) then loc.latitude end,
    case when public.can_view_job_exact_location(j.id) then loc.longitude end,
    case when public.can_view_job_exact_location(j.id) then loc.access_notes end,
    j.confirmed_at,
    j.updated_at,
    j.completion_requested_at,
    public.paid_scope_additional_for_job(j.id),
    pv.price_amount
      + public.paid_scope_additional_for_job(j.id)
      + public.unpaid_scope_additional_for_job(j.id),
    case
      when j.status <> 'COMPLETED' then 'NOT_DUE'
      when public.job_is_settled(j.id) then 'SETTLED'
      when coalesce(pv.price_amount, 0) + public.unpaid_scope_additional_for_job(j.id) <= 0 then 'NOT_REQUIRED'
      else 'DUE'
    end,
    coalesce(pv.price_amount, 0) + public.unpaid_scope_additional_for_job(j.id),
    public.unpaid_scope_additional_for_job(j.id),
    public.unpaid_scope_change_ids_for_job(j.id),
    case when caller_id = j.client_user_id then j.confirmation_code end,
    public.settled_amount_for_job(j.id),
    j.delivery_submitted_at,
    j.delivery_summary,
    j.delivery_evidence_url,
    j.handover_verified_at,
    j.correction_count
  from public.jobs j
  join public.proposal_versions pv on pv.id = j.accepted_proposal_version_id
  left join public.job_schedule_versions sv on sv.id = j.current_schedule_version_id
  left join public.profiles peer on peer.id = case
    when caller_id = j.client_user_id then j.provider_user_id
    else j.client_user_id
  end
  left join public.job_private_locations loc on loc.job_id = j.id
  where j.id = target_job_id;
end;
$$;

revoke all on function public.get_job_detail(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_job_detail(uuid)
to authenticated, service_role;

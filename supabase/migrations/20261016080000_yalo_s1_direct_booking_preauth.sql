-- YALO S1: reserva directa con preautorizacion explicita (D2).
-- Antes, DIRECT_BOOKING creaba propuesta ACCEPTED + trabajo CONFIRMED con
-- solo exigir precio fijo. Ahora exige: servicio con instant_booking_enabled,
-- prestador ACTIVE no pausado y ventana con disponibilidad verificada bajo
-- lock. Sin preautorizacion nace solicitud OPEN para aceptacion bilateral.
-- Tambien agrega idempotencia de creacion y exclusion anti-doble-booking
-- en holds. Todo append-only; no toca datos existentes.

-- 1) Flag de preautorizacion por servicio (default OFF = conducta anterior
-- de solicitud; el prestador lo activa por servicio desde /provider/manage).
alter table public.services
  add column if not exists instant_booking_enabled boolean not null default false;

comment on column public.services.instant_booking_enabled is
  'Provider pre-authorization for instant direct booking of this service.';

-- 2) Clave de idempotencia de creacion de propuestas (anti doble-tap).
alter table public.proposals
  add column if not exists idempotency_key uuid;

create unique index if not exists proposals_conversation_idempotency_key_uniq
  on public.proposals (conversation_id, idempotency_key)
  where idempotency_key is not null;

-- 3) Limpieza preventiva de holds expirados antes del preflight para evitar
-- bloqueos residuales por sesiones de pago inactivas o abandonadas.
update public.provider_slot_holds
set released_at = expires_at,
    updated_at = timezone('utc', now())
where released_at is null
  and expires_at <= timezone('utc', now());

-- Preflight ANTES de crear la constraint. Nunca permitir que un
-- listado de reservas legacy con solapes cause una migracion a medias.
-- Se informa el numero de solapes sin revelar detalles de usuarios.
do $$
declare
  legacy_overlaps integer;
begin
  select count(*) into legacy_overlaps
  from public.provider_slot_holds a
  join public.provider_slot_holds b
    on a.provider_user_id = b.provider_user_id
   and a.id < b.id
   and a.released_at is null and b.released_at is null
   and tstzrange(a.starts_at, a.ends_at, '[)')
     && tstzrange(b.starts_at, b.ends_at, '[)');
  if legacy_overlaps > 0 then
    raise exception using errcode = '23514',
      message = format('Cannot add slot exclusion: %s legacy overlapping active holds', legacy_overlaps);
  end if;
end;
$$;

-- Exclusion anti-doble-booking en holds activos del mismo prestador.
alter table public.provider_slot_holds
  add constraint provider_slot_holds_no_overlap_excl
  exclude using gist (
    provider_user_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (released_at is null);

-- 4) Vista publica: expone el flag para el CTA correcto de la ficha.
create or replace view public.public_provider_services as
select
  pp.public_slug as provider_slug,
  s.public_slug,
  s.title,
  s.description,
  s.modality,
  s.price_model,
  s.price_amount,
  s.currency_code,
  s.price_unit,
  s.accepts_offers,
  s.expected_duration_minutes,
  s.schedule_type,
  s.includes,
  s.excludes,
  s.materials_notes,
  sk.slug as skill_slug,
  sk.name as skill_name,
  s.sort_order,
  s.instant_booking_enabled
from public.services s
join public.provider_profiles pp on pp.user_id = s.provider_user_id
join public.skills sk on sk.id = s.skill_id and sk.is_active
join public.categories c on c.id = sk.category_id and c.is_active
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused
  and s.is_published
  and not s.is_paused;

-- 5) save_service_with_tags con flag (nueva firma de 19 args). La firma
-- historica de 19 args sigue existiendo y delega con el flag en false.
create or replace function public.save_service_with_tags(
  target_service_id uuid,
  requested_skill_id uuid,
  requested_title text,
  requested_description text,
  requested_modality public.service_modality,
  requested_price_model public.price_model,
  requested_price_amount bigint,
  requested_currency_code text,
  requested_price_unit text,
  requested_accepts_offers boolean,
  requested_expected_duration_minutes integer,
  requested_schedule_type public.schedule_type,
  requested_includes text,
  requested_excludes text,
  requested_materials_notes text,
  requested_is_published boolean,
  requested_is_paused boolean,
  requested_tags text[],
  requested_instant_booking_enabled boolean
)
returns table (id uuid, public_slug text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_user_id uuid := auth.uid();
  saved_id uuid;
  saved_slug text;
begin
  if request_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if target_service_id is null then
    insert into public.services (
      provider_user_id,
      skill_id,
      title,
      description,
      modality,
      price_model,
      price_amount,
      currency_code,
      price_unit,
      accepts_offers,
      instant_booking_enabled,
      expected_duration_minutes,
      schedule_type,
      includes,
      excludes,
      materials_notes,
      is_published,
      is_paused,
      sort_order
    ) values (
      request_user_id,
      requested_skill_id,
      requested_title,
      requested_description,
      requested_modality,
      requested_price_model,
      requested_price_amount,
      requested_currency_code,
      requested_price_unit,
      requested_accepts_offers,
      coalesce(requested_instant_booking_enabled, false),
      requested_expected_duration_minutes,
      requested_schedule_type,
      requested_includes,
      requested_excludes,
      requested_materials_notes,
      requested_is_published,
      requested_is_paused,
      0
    )
    returning services.id, services.public_slug into saved_id, saved_slug;
  else
    update public.services
    set skill_id = requested_skill_id,
        title = requested_title,
        description = requested_description,
        modality = requested_modality,
        price_model = requested_price_model,
        price_amount = requested_price_amount,
        currency_code = requested_currency_code,
        price_unit = requested_price_unit,
        accepts_offers = requested_accepts_offers,
        instant_booking_enabled = coalesce(requested_instant_booking_enabled, false),
        expected_duration_minutes = requested_expected_duration_minutes,
        schedule_type = requested_schedule_type,
        includes = requested_includes,
        excludes = requested_excludes,
        materials_notes = requested_materials_notes,
        is_published = requested_is_published,
        is_paused = requested_is_paused
    where services.id = target_service_id
      and services.provider_user_id = request_user_id
    returning services.id, services.public_slug into saved_id, saved_slug;

    if saved_id is null then
      raise exception 'service does not belong to the authenticated provider'
        using errcode = '42501';
    end if;
  end if;

  perform public.replace_service_tags(saved_id, requested_tags);

  return query select saved_id, saved_slug;
end;
$$;

-- La firma historica delega: misma conducta que antes (flag en false).
create or replace function public.save_service_with_tags(
  target_service_id uuid,
  requested_skill_id uuid,
  requested_title text,
  requested_description text,
  requested_modality public.service_modality,
  requested_price_model public.price_model,
  requested_price_amount bigint,
  requested_currency_code text,
  requested_price_unit text,
  requested_accepts_offers boolean,
  requested_expected_duration_minutes integer,
  requested_schedule_type public.schedule_type,
  requested_includes text,
  requested_excludes text,
  requested_materials_notes text,
  requested_is_published boolean,
  requested_is_paused boolean,
  requested_tags text[]
)
returns table (id uuid, public_slug text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  keep_instant_booking boolean := false;
begin
  if target_service_id is not null then
    select s.instant_booking_enabled into keep_instant_booking
    from public.services s
    where s.id = target_service_id;
    keep_instant_booking := coalesce(keep_instant_booking, false);
  end if;
  return query select * from public.save_service_with_tags(
    target_service_id,
    requested_skill_id,
    requested_title,
    requested_description,
    requested_modality,
    requested_price_model,
    requested_price_amount,
    requested_currency_code,
    requested_price_unit,
    requested_accepts_offers,
    requested_expected_duration_minutes,
    requested_schedule_type,
    requested_includes,
    requested_excludes,
    requested_materials_notes,
    requested_is_published,
    requested_is_paused,
    requested_tags,
    keep_instant_booking
  );
end;
$$;

revoke all on function public.save_service_with_tags(
  uuid, uuid, text, text, public.service_modality, public.price_model, bigint,
  text, text, boolean, integer, public.schedule_type, text, text, text,
  boolean, boolean, text[], boolean
) from public, anon, authenticated;

grant execute on function public.save_service_with_tags(
  uuid, uuid, text, text, public.service_modality, public.price_model, bigint,
  text, text, boolean, integer, public.schedule_type, text, text, text,
  boolean, boolean, text[], boolean
) to authenticated;

-- 6) create_conversation_proposal endurecido (nueva firma de 9 args).
-- DIRECT_BOOKING solo auto-confirma con preautorizacion real; sin ella
-- nace solicitud OPEN para aceptacion bilateral. Nunca crea trabajo sin
-- version aceptada. La firma historica de 8 args delega sin clave.
create or replace function public.create_conversation_proposal(
  target_conversation_id uuid,
  requested_kind public.proposal_kind,
  scope_text text default null,
  proposed_price_amount bigint default null,
  proposed_schedule_start_at timestamptz default null,
  proposed_schedule_end_at timestamptz default null,
  proposed_deadline_at timestamptz default null,
  proposal_expires_at timestamptz default null,
  request_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_service_id uuid;
  target_client_id uuid;
  target_provider_id uuid;
  service_title text;
  service_description text;
  service_modality public.service_modality;
  service_price_model public.price_model;
  service_price_amount bigint;
  service_currency text;
  service_accepts_offers boolean;
  service_schedule_type public.schedule_type;
  service_duration integer;
  service_includes text;
  service_materials text;
  effective_scope text;
  effective_price bigint;
  created_proposal_id uuid;
  created_version_id uuid;
  created_status public.proposal_status := 'OPEN';
  preauth_ok boolean := false;
  violated_constraint text;
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select
    c.service_id,
    c.client_user_id,
    c.provider_user_id,
    s.title,
    s.description,
    s.modality,
    s.price_model,
    s.price_amount,
    s.currency_code,
    s.accepts_offers,
    s.schedule_type,
    s.expected_duration_minutes,
    s.includes,
    s.materials_notes
  into
    target_service_id,
    target_client_id,
    target_provider_id,
    service_title,
    service_description,
    service_modality,
    service_price_model,
    service_price_amount,
    service_currency,
    service_accepts_offers,
    service_schedule_type,
    service_duration,
    service_includes,
    service_materials
  from public.conversations c
  join public.services s on s.id = c.service_id
  where c.id = target_conversation_id
    and caller_id in (c.client_user_id, c.provider_user_id)
  limit 1;

  if target_service_id is null then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  -- Guard heredado de 20261011000002: conversacion bloqueada congela
  -- propuestas para ambas partes (tambien frena la reserva directa).
  if exists (
    select 1
    from public.user_blocks b
    where b.conversation_id = target_conversation_id
      and (
        (b.blocker_user_id = caller_id and b.blocked_user_id in (target_client_id, target_provider_id))
        or (b.blocked_user_id = caller_id and b.blocker_user_id in (target_client_id, target_provider_id))
      )
  ) then
    raise exception using errcode = '42501', message = 'conversation proposals are blocked';
  end if;

  -- Idempotencia de creacion: la misma clave devuelve la propuesta
  -- existente sin duplicar (anti doble-tap / reintento).
  if request_idempotency_key is not null then
    select p.id into created_proposal_id
    from public.proposals p
    where p.conversation_id = target_conversation_id
      and p.idempotency_key = request_idempotency_key;
    if created_proposal_id is not null then
      return created_proposal_id;
    end if;
  end if;

  -- Lock de servicio y prestador: dos reservas directas concurrentes se
  -- serializan antes de verificar preautorizacion y disponibilidad.
  perform 1 from public.services s where s.id = target_service_id for update;
  perform 1 from public.provider_profiles pp where pp.user_id = target_provider_id for update;

  -- Libera holds expirados del prestador para alinear el estado real con
  -- la constraint GiST anti-solape.
  update public.provider_slot_holds
  set released_at = event_time,
      updated_at = event_time
  where provider_user_id = target_provider_id
    and released_at is null
    and expires_at <= event_time;

  if proposal_expires_at is not null and proposal_expires_at <= event_time then
    raise exception using errcode = '22023', message = 'proposal expiry must be in the future';
  end if;

  if proposed_schedule_end_at is not null
    and proposed_schedule_start_at is not null
    and proposed_schedule_end_at <= proposed_schedule_start_at then
    raise exception using errcode = '22023', message = 'schedule end must be after start';
  end if;

  effective_scope := coalesce(nullif(btrim(scope_text), ''), service_description);
  if char_length(effective_scope) not between 3 and 4000 then
    raise exception using errcode = '22023', message = 'proposal scope is invalid';
  end if;

  case requested_kind
    when 'DIRECT_BOOKING' then
      if caller_id <> target_client_id then
        raise exception using errcode = '42501', message = 'only the client can create a direct booking';
      end if;
      if service_price_model <> 'FIXED' or service_price_amount is null then
        raise exception using errcode = '22023', message = 'direct booking requires a fixed-price service';
      end if;
      effective_price := service_price_amount;
      -- Preautorizacion real: flag del servicio + prestador ACTIVE no
      -- pausado. Sin ella queda solicitud OPEN (aceptacion bilateral).
      select coalesce(s.instant_booking_enabled, false)
        and pp.status = 'ACTIVE'
        and not coalesce(pp.marketplace_paused, false)
        into preauth_ok
      from public.services s
      join public.provider_profiles pp on pp.user_id = s.provider_user_id
      where s.id = target_service_id;
      -- Sin una ventana de agenda no hay capacidad reservada: queda
      -- propuesta OPEN, no reserva instantanea ni doble booking invisible.
      if proposed_schedule_start_at is null or proposed_schedule_end_at is null then
        preauth_ok := false;
      elsif preauth_ok
        and not public.provider_slot_is_available(
          target_provider_id,
          proposed_schedule_start_at,
          proposed_schedule_end_at
        ) then
        preauth_ok := false;
      end if;
      if preauth_ok then
        created_status := 'ACCEPTED';
      else
        created_status := 'OPEN';
      end if;
    when 'QUOTE_REQUEST' then
      if caller_id <> target_client_id then
        raise exception using errcode = '42501', message = 'only the client can request a quote';
      end if;
      if proposed_price_amount is not null then
        raise exception using errcode = '22023', message = 'quote requests cannot set a price';
      end if;
      effective_price := null;
    when 'CLIENT_OFFER' then
      if caller_id <> target_client_id then
        raise exception using errcode = '42501', message = 'only the client can create a client offer';
      end if;
      if not service_accepts_offers then
        raise exception using errcode = '42501', message = 'this service does not accept offers';
      end if;
      if proposed_price_amount is null or proposed_price_amount <= 0 then
        raise exception using errcode = '22023', message = 'client offer requires a positive price';
      end if;
      effective_price := proposed_price_amount;
    when 'PROVIDER_QUOTE' then
      if caller_id <> target_provider_id then
        raise exception using errcode = '42501', message = 'only the provider can create a provider quote';
      end if;
      if proposed_price_amount is null or proposed_price_amount <= 0 then
        raise exception using errcode = '22023', message = 'provider quote requires a positive price';
      end if;
      effective_price := proposed_price_amount;
    when 'COUNTEROFFER' then
      raise exception using errcode = '22023', message = 'counteroffers require an existing proposal';
  end case;

  begin
    insert into public.proposals (
      conversation_id,
      service_id,
      client_user_id,
      provider_user_id,
      kind,
      status,
      created_by_user_id,
      idempotency_key,
      expires_at,
      created_at,
      updated_at
    ) values (
      target_conversation_id,
      target_service_id,
      target_client_id,
      target_provider_id,
      requested_kind,
      created_status,
      caller_id,
      request_idempotency_key,
      proposal_expires_at,
      event_time,
      event_time
    )
    returning id into created_proposal_id;
  exception when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    if violated_constraint = 'proposals_conversation_idempotency_key_uniq'
      and request_idempotency_key is not null then
      select p.id into created_proposal_id
      from public.proposals p
      where p.conversation_id = target_conversation_id
        and p.idempotency_key = request_idempotency_key;
      if created_proposal_id is not null then
        return created_proposal_id;
      end if;
    end if;
    raise;
  end;

  insert into public.proposal_versions (
    proposal_id,
    version_number,
    kind,
    authored_by_user_id,
    service_title_snapshot,
    service_description_snapshot,
    modality,
    scope_snapshot,
    price_model_snapshot,
    price_amount,
    currency_code,
    schedule_type,
    schedule_start_at,
    schedule_end_at,
    deadline_at,
    expected_duration_minutes,
    includes_snapshot,
    materials_notes_snapshot,
    created_at
  ) values (
    created_proposal_id,
    1,
    requested_kind,
    caller_id,
    service_title,
    service_description,
    service_modality,
    effective_scope,
    service_price_model,
    effective_price,
    service_currency,
    case
      when proposed_schedule_start_at is not null and proposed_schedule_end_at is not null
        then 'FIXED_SLOT'::public.schedule_type
      else coalesce(service_schedule_type, 'UNSCHEDULED'::public.schedule_type)
    end,
    proposed_schedule_start_at,
    proposed_schedule_end_at,
    proposed_deadline_at,
    service_duration,
    service_includes,
    service_materials,
    event_time
  )
  returning id into created_version_id;

  update public.proposals
  set current_version_id = created_version_id,
      accepted_version_id = case
        when requested_kind = 'DIRECT_BOOKING' and created_status = 'ACCEPTED'
          then created_version_id
        else null
      end
  where id = created_proposal_id;

  -- Hire-on-accept solo con version aceptada: reserva directa preautorizada.
  -- Sin preautorizacion no nace trabajo; queda solicitud OPEN bilateral.
  if requested_kind = 'DIRECT_BOOKING' and created_status = 'ACCEPTED' then
    insert into public.jobs (
      conversation_id,
      service_id,
      client_user_id,
      provider_user_id,
      accepted_proposal_version_id,
      payment_attempt_id,
      status,
      confirmed_at,
      created_at,
      updated_at
    ) values (
      target_conversation_id,
      target_service_id,
      target_client_id,
      target_provider_id,
      created_version_id,
      null,
      'CONFIRMED',
      event_time,
      event_time,
      event_time
    )
    on conflict (accepted_proposal_version_id)
    do update set accepted_proposal_version_id = excluded.accepted_proposal_version_id;

    -- Capacidad permanente asegurada: initialize_job_schedule() ya inserto
    -- la reserva activa en public.provider_booking_slots bajo lock advisory y
    -- exclusion GiST anti-solape. No se inserta un hold transitorio de 7 dias;
    -- la reserva del trabajo confirmado persiste hasta cancelacion o reprogramacion auditada.
  end if;

  insert into public.proposal_events (
    proposal_id,
    proposal_version_id,
    actor_user_id,
    event_type,
    metadata,
    created_at
  ) values (
    created_proposal_id,
    created_version_id,
    caller_id,
    case
      when requested_kind = 'DIRECT_BOOKING' and created_status = 'ACCEPTED'
        then 'DIRECT_BOOKING_CREATED'
      when requested_kind = 'DIRECT_BOOKING' then 'DIRECT_BOOKING_REQUESTED'
      else 'PROPOSAL_CREATED'
    end,
    jsonb_build_object('kind', requested_kind::text, 'status', created_status::text),
    event_time
  );

  insert into public.messages (
    conversation_id,
    sender_user_id,
    kind,
    body,
    created_at
  ) values (
    target_conversation_id,
    null,
    'SYSTEM',
    case
      when requested_kind = 'DIRECT_BOOKING' and created_status = 'ACCEPTED'
        then 'Reserva directa creada. Trabajo confirmado.'
      when requested_kind = 'DIRECT_BOOKING'
        then 'Solicitud de contratacion enviada. El prestador debe aceptar.'
      else 'Se creo una propuesta estructurada.'
    end,
    event_time
  );

  update public.conversations
  set last_message_at = event_time,
      updated_at = event_time
  where id = target_conversation_id;

  return created_proposal_id;
end;
$$;

-- La firma historica delega sin clave: misma conducta que antes salvo el
-- endurecimiento de preautorizacion, que aplica a ambas firmas.
create or replace function public.create_conversation_proposal(
  target_conversation_id uuid,
  requested_kind public.proposal_kind,
  scope_text text default null,
  proposed_price_amount bigint default null,
  proposed_schedule_start_at timestamptz default null,
  proposed_schedule_end_at timestamptz default null,
  proposed_deadline_at timestamptz default null,
  proposal_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return public.create_conversation_proposal(
    target_conversation_id,
    requested_kind,
    scope_text,
    proposed_price_amount,
    proposed_schedule_start_at,
    proposed_schedule_end_at,
    proposed_deadline_at,
    proposal_expires_at,
    null
  );
end;
$$;

revoke all on function public.create_conversation_proposal(
  uuid,
  public.proposal_kind,
  text,
  bigint,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid
) from public, anon, authenticated, service_role;

grant execute on function public.create_conversation_proposal(
  uuid,
  public.proposal_kind,
  text,
  bigint,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid
) to authenticated, service_role;

-- El preflight de holds se ejecuta arriba, antes del ALTER TABLE.
-- Aplicar solo tras ensayar en staging y revisar compatibilidad de firmas.

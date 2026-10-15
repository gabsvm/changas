-- YALO S2: camino B de necesidad abierta (job posts).
-- El cliente publica una necesidad; prestadores responden con ofertas que
-- son propuestas PROVIDER_QUOTE en conversaciones 1:1 atadas al post (sin
-- fugas: cada conversacion solo la ven sus dos participantes). Cierre
-- manual del dueno o automatico al contratarse (trigger en jobs).
-- Append-only; no toca datos existentes.

create type public.job_post_status as enum ('OPEN', 'PAUSED', 'CLOSED', 'HIRED');

create table public.job_posts (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null,
  skill_id uuid not null,
  title text not null check (char_length(title) between 10 and 120),
  description text not null check (char_length(description) between 20 and 4000),
  location_text text null check (location_text is null or char_length(location_text) between 2 and 200),
  schedule_start_at timestamptz null,
  schedule_end_at timestamptz null,
  desired_budget_amount bigint null check (desired_budget_amount is null or desired_budget_amount > 0),
  currency_code text not null default 'ARS' check (char_length(currency_code) = 3),
  photo_urls text[] not null default '{}',
  status public.job_post_status not null default 'OPEN',
  idempotency_key uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (schedule_end_at is null or schedule_start_at is null or schedule_end_at > schedule_start_at)
);

comment on table public.job_posts is 'Client open needs (camino B). Offers live in bound 1:1 conversations.';
comment on column public.job_posts.owner_user_id is 'Client who published the need. No FK by repo convention (see proposals).';

create unique index if not exists job_posts_owner_idempotency_uniq
  on public.job_posts (owner_user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists job_posts_open_skill_created_idx
  on public.job_posts (status, skill_id, created_at desc);

comment on column public.job_posts.desired_budget_amount
is 'Orientative budget in minor units (centavos) ARS, null when open.';

create table public.job_post_events (
  id uuid primary key default extensions.gen_random_uuid(),
  job_post_id uuid not null,
  actor_user_id uuid null,
  event_type text not null check (char_length(event_type) between 2 and 80),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.job_post_events is 'Audit trail of open needs (created, responded, paused, closed).';

alter table public.conversations
  add column if not exists job_post_id uuid null;

create index if not exists conversations_job_post_idx
  on public.conversations (job_post_id);

comment on column public.conversations.job_post_id is 'Bound open need, if this thread answers one. Offers stay 1:1.';

-- Una necesidad equivale a una sola contratacion. Este PK asegura
-- materialmente un unico ganador, incluso si otro proceso intenta escribir
-- un segundo trabajo por otro hilo del mismo anuncio.
create table public.job_post_awards (
  job_post_id uuid primary key references public.job_posts(id) on delete restrict,
  job_id uuid not null unique references public.jobs(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);
alter table public.job_post_awards enable row level security;
revoke all privileges on table public.job_post_awards from public, anon, authenticated;
grant select, insert on public.job_post_awards to service_role;

-- BEFORE INSERT bloquea la fila del post: dos aceptaciones desde distintas
-- conversaciones se serializan. La segunda ve HIRED tras el commit de la
-- primera y NO puede crear otro trabajo, incluso por invocacion directa RPC.
create or replace function public.guard_job_post_single_award()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  bound_post_id uuid;
  post_owner_id uuid;
  post_status public.job_post_status;
begin
  select c.job_post_id into bound_post_id
  from public.conversations c
  where c.id = NEW.conversation_id;
  if bound_post_id is null then
    return NEW;
  end if;

  select p.owner_user_id, p.status into post_owner_id, post_status
  from public.job_posts p
  where p.id = bound_post_id
  for update;

  if post_owner_id is null or post_owner_id <> NEW.client_user_id then
    raise exception using errcode = '42501', message = 'post/client contract mismatch';
  end if;
  if post_status <> 'OPEN' then
    raise exception using errcode = '40001', message = 'post already awarded or no longer open';
  end if;
  return NEW;
end;
$$;

drop trigger if exists guard_job_post_single_award_trigger on public.jobs;
create trigger guard_job_post_single_award_trigger
before insert on public.jobs
for each row execute function public.guard_job_post_single_award();

-- Cierre automatico: cualquier trabajo nacido de un hilo atado cierra el
-- post (manual o previo estado PAUSED incluido).
create or replace function public.close_job_post_on_hire()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  bound_post_id uuid;
begin
  select c.job_post_id into bound_post_id
  from public.conversations c
  where c.id = NEW.conversation_id;

  if bound_post_id is null then
    return NEW;
  end if;

  update public.job_posts
  set status = 'HIRED', updated_at = timezone('utc', now())
  where id = bound_post_id
    and status in ('OPEN', 'PAUSED');

  if found then
    insert into public.job_post_awards (job_post_id, job_id)
    values (bound_post_id, NEW.id);

    insert into public.job_post_events (job_post_id, actor_user_id, event_type, metadata)
    values (bound_post_id, NEW.client_user_id, 'AUTO_HIRED_ON_HIRE', jsonb_build_object('job_id', NEW.id));
  end if;

  return NEW;
end;
$$;

drop trigger if exists close_job_post_on_hire_trigger on public.jobs;

create trigger close_job_post_on_hire_trigger
after insert on public.jobs
for each row execute function public.close_job_post_on_hire();

-- RLS: el dueno ve y gobierna lo suyo; cualquier autenticado ve OPEN.
-- Escrituras solo via RPC (definer); sin grants directos de escritura.
alter table public.job_posts enable row level security;
alter table public.job_post_events enable row level security;

drop policy if exists job_posts_select_own_or_open on public.job_posts;

create policy job_posts_select_own_or_open
on public.job_posts
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or status = 'OPEN'
);

drop policy if exists job_post_events_select_own on public.job_post_events;

create policy job_post_events_select_own
on public.job_post_events
for select
to authenticated
using (
  exists (
    select 1 from public.job_posts p
    where p.id = job_post_events.job_post_id
      and p.owner_user_id = auth.uid()
  )
);

-- Lectura via RLS; escrituras solo via RPC. Sin grants, ni siquiera la
-- lectura permitida por policy prospera.
revoke all privileges on table public.job_posts from public, anon, authenticated;
revoke all privileges on table public.job_post_events from public, anon, authenticated;

grant select on table public.job_posts to authenticated;
grant select on table public.job_post_events to authenticated;

grant select, insert, update, delete on table public.job_posts to service_role;
grant select, insert, update, delete on table public.job_post_events to service_role;

-- Crear necesidad (idempotente por dueno+clave).
create or replace function public.create_job_post(
  requested_skill_id uuid,
  requested_title text,
  requested_description text,
  requested_location_text text default null,
  proposed_schedule_start_at timestamptz default null,
  proposed_schedule_end_at timestamptz default null,
  desired_budget_amount bigint default null,
  requested_currency_code text default 'ARS',
  request_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  created_post_id uuid;
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if request_idempotency_key is not null then
    select p.id into created_post_id
    from public.job_posts p
    where p.owner_user_id = caller_id
      and p.idempotency_key = request_idempotency_key;
    if created_post_id is not null then
      return created_post_id;
    end if;
  end if;

  if not exists (
    select 1 from public.skills s
    where s.id = requested_skill_id and s.is_active
  ) then
    raise exception using errcode = '22023', message = 'skill is not available';
  end if;

  if char_length(btrim(coalesce(requested_title, ''))) not between 10 and 120 then
    raise exception using errcode = '22023', message = 'post title is invalid';
  end if;

  if char_length(btrim(coalesce(requested_description, ''))) not between 20 and 4000 then
    raise exception using errcode = '22023', message = 'post description is invalid';
  end if;

  if requested_location_text is not null
    and char_length(btrim(requested_location_text)) not between 2 and 200 then
    raise exception using errcode = '22023', message = 'post location is invalid';
  end if;

  if proposed_schedule_end_at is not null
    and proposed_schedule_start_at is not null
    and proposed_schedule_end_at <= proposed_schedule_start_at then
    raise exception using errcode = '22023', message = 'schedule end must be after start';
  end if;

  if desired_budget_amount is not null and desired_budget_amount <= 0 then
    raise exception using errcode = '22023', message = 'budget must be positive';
  end if;

  if requested_currency_code is null
    or char_length(btrim(requested_currency_code)) <> 3 then
    raise exception using errcode = '22023', message = 'currency is invalid';
  end if;

  begin
    insert into public.job_posts (
      owner_user_id,
      skill_id,
      title,
      description,
      location_text,
      schedule_start_at,
      schedule_end_at,
      desired_budget_amount,
      currency_code,
      status,
      idempotency_key,
      created_at,
      updated_at
    ) values (
      caller_id,
      requested_skill_id,
      btrim(requested_title),
      btrim(requested_description),
      nullif(btrim(coalesce(requested_location_text, '')), ''),
      proposed_schedule_start_at,
      proposed_schedule_end_at,
      desired_budget_amount,
      upper(btrim(requested_currency_code)),
      'OPEN',
      request_idempotency_key,
      event_time,
      event_time
    )
    returning id into created_post_id;
  exception when unique_violation then
    if request_idempotency_key is not null then
      select p.id into created_post_id
      from public.job_posts p
      where p.owner_user_id = caller_id
        and p.idempotency_key = request_idempotency_key;
      if created_post_id is not null then
        return created_post_id;
      end if;
    end if;
    raise;
  end;

  insert into public.job_post_events (job_post_id, actor_user_id, event_type, metadata)
  values (created_post_id, caller_id, 'POST_CREATED', jsonb_build_object('status', 'OPEN'));

  return created_post_id;
end;
$$;

revoke all on function public.create_job_post(
  uuid, text, text, text, timestamptz, timestamptz, bigint, text, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.create_job_post(
  uuid, text, text, text, timestamptz, timestamptz, bigint, text, uuid
) to authenticated, service_role;

-- Transicion de estado del dueno: OPEN<->PAUSED y cierre.
create or replace function public.update_job_post_status(
  target_post_id uuid,
  requested_status public.job_post_status
)
returns public.job_post_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  current_status public.job_post_status;
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select status into current_status
  from public.job_posts
  where id = target_post_id
    and owner_user_id = caller_id
  for update;

  if current_status is null then
    raise exception using errcode = '42501', message = 'only the owner governs the post';
  end if;

  if current_status = requested_status then
    return current_status;
  end if;

  if not (
    (current_status = 'OPEN' and requested_status in ('PAUSED', 'CLOSED'))
    or (current_status = 'PAUSED' and requested_status in ('OPEN', 'CLOSED'))
  ) then
    raise exception using errcode = '22023', message = 'post transition is invalid';
  end if;

  update public.job_posts
  set status = requested_status, updated_at = event_time
  where id = target_post_id;

  insert into public.job_post_events (job_post_id, actor_user_id, event_type, metadata)
  values (
    target_post_id,
    caller_id,
    case requested_status
      when 'PAUSED' then 'POST_PAUSED'
      when 'CLOSED' then 'POST_CLOSED'
      else 'POST_REOPENED'
    end,
    jsonb_build_object('from', current_status::text, 'to', requested_status::text)
  );

  return requested_status;
end;
$$;

revoke all on function public.update_job_post_status(uuid, public.job_post_status)
from public, anon, authenticated, service_role;

grant execute on function public.update_job_post_status(uuid, public.job_post_status)
to authenticated, service_role;

-- Una oferta por hilo: mismo post + misma dupla comparte conversacion.
create unique index job_post_conversation_pair_uniq
on public.conversations (job_post_id, client_user_id, provider_user_id);

-- Ofertar en una necesidad: el prestador ancla uno de sus servicios
-- publicados y abre (o reusa) el hilo 1:1 con el dueno del post.
create or replace function public.start_post_offer_conversation(
  target_post_id uuid,
  target_service_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  post_owner_id uuid;
  post_skill_id uuid;
  created_conversation_id uuid;
  existing_conversation_id uuid;
  existing_post_id uuid;
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select p.owner_user_id, p.skill_id into post_owner_id, post_skill_id
  from public.job_posts p
  where p.id = target_post_id
    and p.status = 'OPEN';

  if post_owner_id is null then
    raise exception using errcode = '22023', message = 'post is not open';
  end if;

  if caller_id = post_owner_id then
    raise exception using errcode = '22023', message = 'cannot offer on your own post';
  end if;

  if not exists (
    select 1
    from public.services s
    join public.provider_profiles pp on pp.user_id = s.provider_user_id
    where s.id = target_service_id
      and s.provider_user_id = caller_id
      and s.skill_id = post_skill_id
      and s.is_published = true
      and s.is_paused = false
      and pp.status = 'ACTIVE'
      and pp.marketplace_paused = false
  ) then
    raise exception using errcode = '42501', message = 'offer service is not available';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_user_id = caller_id and b.blocked_user_id = post_owner_id)
       or (b.blocker_user_id = post_owner_id and b.blocked_user_id = caller_id)
  ) then
    raise exception using errcode = '42501', message = 'conversation start is blocked';
  end if;

  select c.id into created_conversation_id
  from public.conversations c
  where c.job_post_id = target_post_id
    and c.client_user_id = post_owner_id
    and c.provider_user_id = caller_id;

  if created_conversation_id is not null then
    return created_conversation_id;
  end if;

  -- El hilo de catalogo (service_id, dupla) es unico: si ya existe para
  -- este servicio y esta dupla, se ata al post cuando esta libre.
  select c.id, c.job_post_id into existing_conversation_id, existing_post_id
  from public.conversations c
  where c.service_id = target_service_id
    and c.client_user_id = post_owner_id
    and c.provider_user_id = caller_id;

  if existing_conversation_id is not null then
    if existing_post_id = target_post_id then
      return existing_conversation_id;
    end if;
    if existing_post_id is null then
      begin
        update public.conversations
        set job_post_id = target_post_id, updated_at = event_time
        where id = existing_conversation_id;
      exception when unique_violation then
        -- Carrera con otro hilo de la dupla: el hilo ya atado gana.
        select c.id into created_conversation_id
        from public.conversations c
        where c.job_post_id = target_post_id
          and c.client_user_id = post_owner_id
          and c.provider_user_id = caller_id;
        if created_conversation_id is null then
          raise;
        end if;
        return created_conversation_id;
      end;

      insert into public.job_post_events (job_post_id, actor_user_id, event_type, metadata)
      values (
        target_post_id,
        caller_id,
        'OFFER_RECEIVED',
        jsonb_build_object('conversation_id', existing_conversation_id)
      );

      return existing_conversation_id;
    end if;
    raise exception using errcode = '22023', message = 'service thread already discusses another post';
  end if;

  begin
    insert into public.conversations (
      service_id, client_user_id, provider_user_id, job_post_id
    ) values (
      target_service_id, post_owner_id, caller_id, target_post_id
    )
    returning id into created_conversation_id;
  exception when unique_violation then
    select c.id into created_conversation_id
    from public.conversations c
    where c.job_post_id = target_post_id
      and c.client_user_id = post_owner_id
      and c.provider_user_id = caller_id;
    if created_conversation_id is not null then
      return created_conversation_id;
    end if;
    raise;
  end;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    (created_conversation_id, post_owner_id, 'CLIENT'),
    (created_conversation_id, caller_id, 'PROVIDER')
  on conflict (conversation_id, user_id) do nothing;

  insert into public.job_post_events (job_post_id, actor_user_id, event_type, metadata)
  values (
    target_post_id,
    caller_id,
    'OFFER_RECEIVED',
    jsonb_build_object('conversation_id', created_conversation_id)
  );

  return created_conversation_id;
end;
$$;

revoke all on function public.start_post_offer_conversation(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.start_post_offer_conversation(uuid, uuid)
to authenticated, service_role;

-- Read model de ofertas economicas (no 'interesados'): expone una sola
-- propuesta vigente de cada prestador SOLO al dueno de la necesidad.
-- No entrega ofertas privadas a otros prestadores, ni datos de contacto.
create or replace function public.list_job_post_offer_cards(target_post_id uuid)
returns table (
  conversation_id uuid,
  provider_user_id uuid,
  provider_name text,
  proposal_id uuid,
  proposal_status public.proposal_status,
  price_amount bigint,
  currency_code text,
  scope_snapshot text,
  schedule_start_at timestamptz,
  schedule_end_at timestamptz,
  offer_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or not exists (
    select 1 from public.job_posts jp
    where jp.id = target_post_id and jp.owner_user_id = caller_id
  ) then
    raise exception using errcode = '42501', message = 'post offers access denied';
  end if;

  return query
  select distinct on (c.provider_user_id)
    c.id,
    c.provider_user_id,
    coalesce(pr.display_name, 'Prestador')::text,
    p.id,
    p.status,
    pv.price_amount,
    pv.currency_code,
    pv.scope_snapshot,
    pv.schedule_start_at,
    pv.schedule_end_at,
    p.updated_at
  from public.conversations c
  join public.proposals p on p.conversation_id = c.id
  join public.proposal_versions pv on pv.id = p.current_version_id
  left join public.profiles pr on pr.id = c.provider_user_id
  where c.job_post_id = target_post_id
    and p.status in ('OPEN', 'ACCEPTED')
    and pv.authored_by_user_id = c.provider_user_id
    and pv.price_amount is not null
    and pv.price_amount > 0
  order by c.provider_user_id, p.updated_at desc, p.id desc;
end;
$$;

revoke all on function public.list_job_post_offer_cards(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_job_post_offer_cards(uuid)
to authenticated, service_role;

-- Solicitudes de habilidades custom: el prestador propone nombre + servicio,
-- el admin aprueba (nueva o fusionada) o rechaza. Al aprobar se crea todo
-- junto: skill (+sinónimo si fusiona), provider_skill y servicio en borrador.

create table public.skill_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null
    check (char_length(btrim(name)) between 2 and 80),
  category_id uuid not null references public.categories (id) on delete restrict,
  description text
    check (description is null or char_length(description) <= 500),
  service_title text not null
    check (char_length(btrim(service_title)) between 3 and 120),
  service_description text not null
    check (char_length(btrim(service_description)) between 20 and 3000),
  service_modality public.service_modality not null,
  service_price_model public.price_model not null,
  service_price_amount bigint,
  service_price_unit text
    check (service_price_unit is null or char_length(btrim(service_price_unit)) between 2 and 60),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'MERGED', 'REJECTED')),
  matched_skill_id uuid references public.skills (id) on delete restrict,
  reviewer_note text,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (service_price_model = 'QUOTE' and service_price_amount is null and service_price_unit is null)
    or (
      service_price_model = 'PER_UNIT'
      and service_price_amount is not null and service_price_amount > 0
      and service_price_unit is not null
    )
    or (
      service_price_model <> 'QUOTE' and service_price_model <> 'PER_UNIT'
      and service_price_amount is not null and service_price_amount > 0
      and service_price_unit is null
    )
  )
);

alter table public.skill_requests enable row level security;

create policy skill_requests_select_own
on public.skill_requests for select to authenticated
using (requester_user_id = (select auth.uid()));

create policy skill_requests_insert_own
on public.skill_requests for insert to authenticated
with check (
  requester_user_id = (select auth.uid())
  and exists (
    select 1 from public.provider_profiles pp
    where pp.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.categories c
    where c.id = category_id and c.is_active
  )
);

-- 1) Proponer: si el nombre ya existe (skill o sinónimo activo) no se crea
-- solicitud: se agrega directo al perfil y se devuelve la skill existente.
create or replace function public.submit_skill_request(
  requested_name text,
  requested_category_id uuid,
  requested_description text default null,
  requested_service_title text default null,
  requested_service_description text default null,
  requested_service_modality public.service_modality default 'BOTH',
  requested_service_price_model public.price_model default 'QUOTE',
  requested_service_price_amount bigint default null,
  requested_service_price_unit text default null
)
returns table (request_id uuid, attached_skill_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  clean_name text := btrim(requested_name);
  normalized_name text := lower(btrim(requested_name));
  existing_skill_id uuid;
  existing_request_id uuid;
  created_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if clean_name is null or char_length(clean_name) < 2 or char_length(clean_name) > 80 then
    raise exception using errcode = '22023', message = 'skill name must be 2-80 characters';
  end if;
  if requested_service_title is null or char_length(btrim(requested_service_title)) < 3 then
    raise exception using errcode = '22023', message = 'service title must be at least 3 characters';
  end if;
  if requested_service_description is null or char_length(btrim(requested_service_description)) < 20 then
    raise exception using errcode = '22023', message = 'service description must be at least 20 characters';
  end if;
  if not exists (
    select 1 from public.provider_profiles pp where pp.user_id = caller_id
  ) then
    raise exception using errcode = '42501', message = 'provider profile is required';
  end if;
  if not exists (
    select 1 from public.categories c
    where c.id = requested_category_id and c.is_active
  ) then
    raise exception using errcode = '22023', message = 'category is not available';
  end if;

  -- Ya existe: adjuntar sin revisión.
  select s.id into existing_skill_id
  from public.skills s
  where s.is_active
    and (
      lower(btrim(s.name)) = normalized_name
      or exists (
        select 1 from public.skill_synonyms syn
        where syn.skill_id = s.id and syn.normalized_phrase = normalized_name
      )
    )
  limit 1;

  if existing_skill_id is not null then
    insert into public.provider_skills (provider_user_id, skill_id)
    values (caller_id, existing_skill_id)
    on conflict (provider_user_id, skill_id) do nothing;
    return query select null::uuid, existing_skill_id;
    return;
  end if;

  -- Pendiente duplicado del mismo usuario: devolver el existente.
  select r.id into existing_request_id
  from public.skill_requests r
  where r.requester_user_id = caller_id
    and r.status = 'PENDING'
    and lower(btrim(r.name)) = normalized_name
  limit 1;

  if existing_request_id is not null then
    return query select existing_request_id, null::uuid;
    return;
  end if;

  insert into public.skill_requests (
    requester_user_id, name, category_id, description,
    service_title, service_description, service_modality,
    service_price_model, service_price_amount, service_price_unit
  ) values (
    caller_id, clean_name, requested_category_id,
    nullif(btrim(coalesce(requested_description, '')), ''),
    btrim(requested_service_title), btrim(requested_service_description),
    requested_service_modality, requested_service_price_model,
    requested_service_price_amount,
    nullif(btrim(coalesce(requested_service_price_unit, '')), '')
  )
  returning id into created_id;

  return query select created_id, null::uuid;
end;
$$;

-- 2) Revisar (admin): aprueba como nueva, fusiona a existente o rechaza.
-- Todo ocurre en una transacción: skill + provider_skill + servicio borrador.
create or replace function public.review_skill_request(
  target_request_id uuid,
  decision text,
  matched_skill_id uuid default null,
  reviewer_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  admin_id uuid := auth.uid();
  req public.skill_requests%rowtype;
  final_skill_id uuid;
  base_slug text;
  candidate_slug text;
  attempt integer := 0;
  created_service_id uuid;
  clean_note text := nullif(btrim(coalesce(reviewer_note, '')), '');
begin
  perform public.require_admin();

  select * into req from public.skill_requests where id = target_request_id for update;
  if req.id is null then
    raise exception using errcode = '22023', message = 'request not found';
  end if;
  if req.status <> 'PENDING' then
    raise exception using errcode = '22023', message = 'request already decided';
  end if;

  if decision = 'REJECT' then
    if clean_note is null then
      raise exception using errcode = '22023', message = 'a reason is required to reject';
    end if;
    update public.skill_requests
    set status = 'REJECTED', reviewer_note = clean_note,
        decided_by = admin_id, decided_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where id = target_request_id;
  elsif decision = 'APPROVE_NEW' then
    base_slug := regexp_replace(lower(req.name), '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '(^-+|-+$)', '', 'g');
    if base_slug is null or base_slug = '' then
      base_slug := 'habilidad';
    end if;
    candidate_slug := base_slug;
    while exists (select 1 from public.skills s where s.slug = candidate_slug) loop
      attempt := attempt + 1;
      candidate_slug := base_slug || '-' || attempt::text;
    end loop;

    insert into public.skills (category_id, slug, name, description)
    values (req.category_id, candidate_slug, btrim(req.name), req.description)
    returning id into final_skill_id;

    insert into public.provider_skills (provider_user_id, skill_id)
    values (req.requester_user_id, final_skill_id)
    on conflict (provider_user_id, skill_id) do nothing;

    insert into public.services (
      provider_user_id, skill_id, title, description, modality,
      price_model, price_amount, currency_code, price_unit,
      is_published, is_paused, sort_order
    ) values (
      req.requester_user_id, final_skill_id, req.service_title, req.service_description,
      req.service_modality, req.service_price_model, req.service_price_amount,
      'ARS', req.service_price_unit, false, false, 0
    )
    returning id into created_service_id;

    update public.skill_requests
    set status = 'APPROVED', matched_skill_id = final_skill_id,
        reviewer_note = clean_note,
        decided_by = admin_id, decided_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where id = target_request_id;
  elsif decision = 'MERGE' then
    if matched_skill_id is null then
      raise exception using errcode = '22023', message = 'merge target skill is required';
    end if;
    if not exists (
      select 1 from public.skills s where s.id = matched_skill_id and s.is_active
    ) then
      raise exception using errcode = '22023', message = 'merge target skill is not available';
    end if;
    final_skill_id := matched_skill_id;

    insert into public.skill_synonyms (skill_id, phrase, normalized_phrase)
    values (final_skill_id, btrim(req.name), lower(btrim(req.name)))
    on conflict (skill_id, normalized_phrase) do nothing;

    insert into public.provider_skills (provider_user_id, skill_id)
    values (req.requester_user_id, final_skill_id)
    on conflict (provider_user_id, skill_id) do nothing;

    insert into public.services (
      provider_user_id, skill_id, title, description, modality,
      price_model, price_amount, currency_code, price_unit,
      is_published, is_paused, sort_order
    ) values (
      req.requester_user_id, final_skill_id, req.service_title, req.service_description,
      req.service_modality, req.service_price_model, req.service_price_amount,
      'ARS', req.service_price_unit, false, false, 0
    )
    returning id into created_service_id;

    update public.skill_requests
    set status = 'MERGED', matched_skill_id = final_skill_id,
        reviewer_note = clean_note,
        decided_by = admin_id, decided_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where id = target_request_id;
  else
    raise exception using errcode = '22023', message = 'decision must be APPROVE_NEW, MERGE or REJECT';
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    admin_id,
    'SKILL_REQUEST_' || decision,
    'SKILL_REQUEST',
    target_request_id,
    jsonb_build_object('skill_id', final_skill_id, 'service_id', created_service_id)
  );

  perform public.enqueue_user_notification(
    req.requester_user_id,
    'VERIFICATION'::public.notification_kind,
    case when decision = 'REJECT' then 'Habilidad no aprobada' else 'Habilidad aprobada' end,
    case when decision = 'REJECT'
      then 'Revisá el motivo y proponela de nuevo con ajustes.'
      else 'Ya figura en tu perfil y tu servicio quedó en borrador para publicar.' end,
    '/provider/manage',
    'SKILL_REQUEST_DECIDED',
    target_request_id,
    'skill_request',
    target_request_id,
    true,
    true
  );

  return coalesce(created_service_id, final_skill_id, target_request_id);
end;
$$;

-- 3) Cola admin: pendientes primero.
create or replace function public.list_skill_request_queue()
returns table (
  request_id uuid,
  requester_user_id uuid,
  requester_name text,
  name text,
  category_name text,
  description text,
  service_title text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();

  return query
  select
    r.id,
    r.requester_user_id,
    coalesce(p.display_name, 'Usuario'),
    r.name,
    coalesce(c.name, c.slug, 'Sin categoría'),
    r.description,
    r.service_title,
    r.status,
    r.created_at
  from public.skill_requests r
  left join public.profiles p on p.id = r.requester_user_id
  left join public.categories c on c.id = r.category_id
  order by
    case when r.status = 'PENDING' then 0 else 1 end,
    r.created_at desc;
end;
$$;

revoke all on table public.skill_requests from public, anon, authenticated, service_role;
grant select, insert on table public.skill_requests to authenticated;
grant select, insert on table public.skill_requests to service_role;

revoke all on function public.submit_skill_request(text, uuid, text, text, text, public.service_modality, public.price_model, bigint, text)
from public, anon, authenticated, service_role;
grant execute on function public.submit_skill_request(text, uuid, text, text, text, public.service_modality, public.price_model, bigint, text)
to authenticated, service_role;

revoke all on function public.review_skill_request(uuid, text, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.review_skill_request(uuid, text, uuid, text)
to authenticated, service_role;

revoke all on function public.list_skill_request_queue()
from public, anon, authenticated, service_role;
grant execute on function public.list_skill_request_queue()
to authenticated, service_role;

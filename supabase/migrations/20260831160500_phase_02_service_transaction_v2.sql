-- Refine the Phase 02 transactional service save so tag validation executes
-- after the service mutation, in the same PostgreSQL transaction. Any tag
-- error therefore proves that the preceding service mutation is rolled back.

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

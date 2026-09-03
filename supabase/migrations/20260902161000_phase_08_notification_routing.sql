-- Phase 08: transactional notification routing for meaningful domain events.
-- All copy generated here is intentionally safe for notification surfaces.
-- Private chat text, exact locations, identity documents and review text never
-- enter notifications or the delivery outbox.

create or replace function public.phase08_route_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_row public.conversations%rowtype;
  recipient_id uuid;
begin
  if new.sender_user_id is null or new.kind = 'SYSTEM'::public.message_kind then
    return new;
  end if;

  select conversation.*
  into conversation_row
  from public.conversations conversation
  where conversation.id = new.conversation_id;

  if not found then
    return new;
  end if;

  recipient_id := case
    when new.sender_user_id = conversation_row.client_user_id then conversation_row.provider_user_id
    when new.sender_user_id = conversation_row.provider_user_id then conversation_row.client_user_id
    else null
  end;

  if recipient_id is null then
    return new;
  end if;

  perform public.enqueue_user_notification(
    recipient_id,
    'MESSAGE'::public.notification_kind,
    'Nuevo mensaje',
    'Tenés un mensaje nuevo en Changas.',
    '/messages/' || conversation_row.id::text,
    'MESSAGE_CREATED',
    new.id,
    'conversation',
    conversation_row.id,
    false,
    false
  );

  return new;
end;
$$;

create or replace function public.phase08_route_proposal_event_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal_row public.proposals%rowtype;
  recipient_id uuid;
  proposal_alerts boolean;
  safe_title text;
  safe_body text;
  normalized_event text := upper(new.event_type);
  is_payment_event boolean := upper(new.event_type) in (
    'PAYMENT_SUCCEEDED',
    'PAYMENT_FAILED',
    'PAYMENT_PENDING',
    'FAKE_PAYMENT_SUCCEEDED',
    'FAKE_PAYMENT_FAILED',
    'FAKE_PAYMENT_PENDING'
  );
begin
  select proposal.*
  into proposal_row
  from public.proposals proposal
  where proposal.id = new.proposal_id;

  if not found then
    return new;
  end if;

  if is_payment_event then
    safe_title := case
      when normalized_event like '%SUCCEEDED' then 'Pago confirmado'
      when normalized_event like '%FAILED' then 'No pudimos confirmar el pago'
      else 'Pago pendiente'
    end;
    safe_body := case
      when normalized_event like '%SUCCEEDED' then 'El pago del trabajo fue confirmado.'
      when normalized_event like '%FAILED' then 'El pago necesita una nueva revisión o intento.'
      else 'El pago sigue pendiente de confirmación.'
    end;

    perform public.enqueue_user_notification(
      proposal_row.client_user_id,
      'PAYMENT'::public.notification_kind,
      safe_title,
      safe_body,
      '/messages/' || proposal_row.conversation_id::text,
      normalized_event,
      new.id,
      'proposal',
      proposal_row.id,
      true,
      true
    );

    perform public.enqueue_user_notification(
      proposal_row.provider_user_id,
      'PAYMENT'::public.notification_kind,
      safe_title,
      safe_body,
      '/messages/' || proposal_row.conversation_id::text,
      normalized_event,
      new.id,
      'proposal',
      proposal_row.id,
      true,
      true
    );

    return new;
  end if;

  if normalized_event not in (
    'DIRECT_BOOKING_CREATED',
    'PROPOSAL_CREATED',
    'PROPOSAL_REVISED',
    'PROPOSAL_ACCEPTED',
    'PROPOSAL_REJECTED',
    'PROPOSAL_WITHDRAWN',
    'PROPOSAL_EXPIRED'
  ) then
    return new;
  end if;

  safe_title := case normalized_event
    when 'DIRECT_BOOKING_CREATED' then 'Nueva contratación'
    when 'PROPOSAL_CREATED' then 'Nueva propuesta'
    when 'PROPOSAL_REVISED' then 'Propuesta actualizada'
    when 'PROPOSAL_ACCEPTED' then 'Propuesta aceptada'
    when 'PROPOSAL_REJECTED' then 'Propuesta rechazada'
    when 'PROPOSAL_WITHDRAWN' then 'Propuesta retirada'
    else 'Propuesta vencida'
  end;
  safe_body := case normalized_event
    when 'DIRECT_BOOKING_CREATED' then 'Hay una nueva contratación para revisar.'
    when 'PROPOSAL_CREATED' then 'Recibiste una nueva propuesta para revisar.'
    when 'PROPOSAL_REVISED' then 'Una propuesta cambió y requiere tu atención.'
    when 'PROPOSAL_ACCEPTED' then 'Una propuesta fue aceptada.'
    when 'PROPOSAL_REJECTED' then 'Una propuesta fue rechazada.'
    when 'PROPOSAL_WITHDRAWN' then 'Una propuesta fue retirada.'
    else 'Una propuesta venció sin completarse.'
  end;

  if new.actor_user_id = proposal_row.client_user_id then
    recipient_id := proposal_row.provider_user_id;
  elsif new.actor_user_id = proposal_row.provider_user_id then
    recipient_id := proposal_row.client_user_id;
  else
    recipient_id := null;
  end if;

  if recipient_id is not null then
    select preference.proposal_alerts_enabled
    into proposal_alerts
    from public.notification_preferences preference
    where preference.user_id = recipient_id;
    proposal_alerts := coalesce(proposal_alerts, true);

    perform public.enqueue_user_notification(
      recipient_id,
      'PROPOSAL'::public.notification_kind,
      safe_title,
      safe_body,
      '/messages/' || proposal_row.conversation_id::text,
      normalized_event,
      new.id,
      'proposal',
      proposal_row.id,
      proposal_alerts,
      proposal_alerts
    );
  else
    select preference.proposal_alerts_enabled
    into proposal_alerts
    from public.notification_preferences preference
    where preference.user_id = proposal_row.client_user_id;
    proposal_alerts := coalesce(proposal_alerts, true);
    perform public.enqueue_user_notification(
      proposal_row.client_user_id,
      'PROPOSAL'::public.notification_kind,
      safe_title,
      safe_body,
      '/messages/' || proposal_row.conversation_id::text,
      normalized_event,
      new.id,
      'proposal',
      proposal_row.id,
      proposal_alerts,
      proposal_alerts
    );

    select preference.proposal_alerts_enabled
    into proposal_alerts
    from public.notification_preferences preference
    where preference.user_id = proposal_row.provider_user_id;
    proposal_alerts := coalesce(proposal_alerts, true);
    perform public.enqueue_user_notification(
      proposal_row.provider_user_id,
      'PROPOSAL'::public.notification_kind,
      safe_title,
      safe_body,
      '/messages/' || proposal_row.conversation_id::text,
      normalized_event,
      new.id,
      'proposal',
      proposal_row.id,
      proposal_alerts,
      proposal_alerts
    );
  end if;

  return new;
end;
$$;

create or replace function public.phase08_route_job_event_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.jobs%rowtype;
  recipient_id uuid;
  safe_title text;
  safe_body text;
  normalized_event text := upper(new.event_type);
  lifecycle_state text := coalesce(new.to_status::text, '');
begin
  if normalized_event not in (
    'JOB_CONFIRMED',
    'JOB_STATUS_CHANGED',
    'RESCHEDULE_REQUESTED',
    'RESCHEDULE_ACCEPTED',
    'RESCHEDULE_REJECTED'
  ) then
    return new;
  end if;

  select job.*
  into job_row
  from public.jobs job
  where job.id = new.job_id;

  if not found then
    return new;
  end if;

  if normalized_event = 'JOB_CONFIRMED' then
    safe_title := 'Trabajo confirmado';
    safe_body := 'El trabajo ya está confirmado en Changas.';
  elsif normalized_event = 'RESCHEDULE_REQUESTED' then
    safe_title := 'Cambio de horario solicitado';
    safe_body := 'Hay una solicitud para cambiar el horario del trabajo.';
  elsif normalized_event = 'RESCHEDULE_ACCEPTED' then
    safe_title := 'Nuevo horario confirmado';
    safe_body := 'El cambio de horario del trabajo fue aceptado.';
  elsif normalized_event = 'RESCHEDULE_REJECTED' then
    safe_title := 'Cambio de horario rechazado';
    safe_body := 'La solicitud de cambio de horario fue rechazada.';
  elsif lifecycle_state = 'IN_PROGRESS' then
    safe_title := 'Trabajo iniciado';
    safe_body := 'El trabajo figura como iniciado.';
  elsif lifecycle_state = 'COMPLETION_REQUESTED' then
    safe_title := 'Finalización solicitada';
    safe_body := 'Hay una solicitud para confirmar la finalización del trabajo.';
  elsif lifecycle_state = 'COMPLETED' then
    safe_title := 'Trabajo completado';
    safe_body := 'El trabajo figura como completado.';
  elsif lifecycle_state = 'CANCELLED' then
    safe_title := 'Trabajo cancelado';
    safe_body := 'El trabajo fue cancelado.';
  elsif lifecycle_state = 'DISPUTED' then
    safe_title := 'Trabajo en revisión';
    safe_body := 'El trabajo requiere revisión.';
  else
    safe_title := 'Trabajo actualizado';
    safe_body := 'Hay una actualización importante en uno de tus trabajos.';
  end if;

  if new.actor_user_id = job_row.client_user_id then
    recipient_id := job_row.provider_user_id;
  elsif new.actor_user_id = job_row.provider_user_id then
    recipient_id := job_row.client_user_id;
  else
    recipient_id := null;
  end if;

  if recipient_id is not null then
    perform public.enqueue_user_notification(
      recipient_id,
      'JOB'::public.notification_kind,
      safe_title,
      safe_body,
      '/jobs/' || job_row.id::text,
      normalized_event || case when lifecycle_state <> '' then ':' || lifecycle_state else '' end,
      new.id,
      'job',
      job_row.id,
      true,
      true
    );
  else
    perform public.enqueue_user_notification(
      job_row.client_user_id,
      'JOB'::public.notification_kind,
      safe_title,
      safe_body,
      '/jobs/' || job_row.id::text,
      normalized_event || case when lifecycle_state <> '' then ':' || lifecycle_state else '' end,
      new.id,
      'job',
      job_row.id,
      true,
      true
    );
    perform public.enqueue_user_notification(
      job_row.provider_user_id,
      'JOB'::public.notification_kind,
      safe_title,
      safe_body,
      '/jobs/' || job_row.id::text,
      normalized_event || case when lifecycle_state <> '' then ':' || lifecycle_state else '' end,
      new.id,
      'job',
      job_row.id,
      true,
      true
    );
  end if;

  return new;
end;
$$;

create or replace function public.phase08_route_review_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enqueue_user_notification(
    new.provider_user_id,
    'REVIEW'::public.notification_kind,
    'Recibiste una nueva reseña',
    'Ya podés verla desde tu perfil en Changas.',
    '/provider',
    'REVIEW_CREATED',
    new.id,
    'review',
    new.id,
    true,
    false
  );

  return new;
end;
$$;

create or replace function public.phase08_route_provider_verification_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  verification_alerts boolean;
  normalized_status text := new.status::text;
  safe_title text;
  safe_body text;
begin
  if old.status is not distinct from new.status
    or normalized_status not in ('ACTIVE', 'REJECTED') then
    return new;
  end if;

  select preference.verification_alerts_enabled
  into verification_alerts
  from public.notification_preferences preference
  where preference.user_id = new.user_id;
  verification_alerts := coalesce(verification_alerts, true);

  if normalized_status = 'ACTIVE' then
    safe_title := 'Verificación aprobada';
    safe_body := 'Tu perfil de prestador ya está habilitado.';
  else
    safe_title := 'Verificación requiere atención';
    safe_body := 'Revisá tu cuenta para continuar con la verificación.';
  end if;

  perform public.enqueue_user_notification(
    new.user_id,
    'VERIFICATION'::public.notification_kind,
    safe_title,
    safe_body,
    '/provider',
    'PROVIDER_VERIFICATION_' || normalized_status,
    new.user_id,
    'provider_profile',
    new.user_id,
    verification_alerts,
    verification_alerts
  );

  return new;
end;
$$;

revoke all on function public.phase08_route_message_notification()
from public, anon, authenticated, service_role;
revoke all on function public.phase08_route_proposal_event_notification()
from public, anon, authenticated, service_role;
revoke all on function public.phase08_route_job_event_notification()
from public, anon, authenticated, service_role;
revoke all on function public.phase08_route_review_notification()
from public, anon, authenticated, service_role;
revoke all on function public.phase08_route_provider_verification_notification()
from public, anon, authenticated, service_role;

create trigger phase08_notify_message_created
after insert on public.messages
for each row execute function public.phase08_route_message_notification();

create trigger phase08_notify_proposal_event_created
after insert on public.proposal_events
for each row execute function public.phase08_route_proposal_event_notification();

create trigger phase08_notify_job_event_created
after insert on public.job_events
for each row execute function public.phase08_route_job_event_notification();

create trigger phase08_notify_review_created
after insert on public.reviews
for each row execute function public.phase08_route_review_notification();

create trigger phase08_notify_provider_verification_changed
after update of status on public.provider_profiles
for each row
when (old.status is distinct from new.status)
execute function public.phase08_route_provider_verification_notification();

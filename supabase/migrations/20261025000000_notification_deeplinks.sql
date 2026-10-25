-- YALO P2.1: deep-links con ancla en notificaciones transaccionales.
--
-- Append-only: no toca migraciones aplicadas, solo reemplaza (create or
-- replace) las funciones de routing/materialización con el mismo contrato
-- de firma y triggers. Las URLs con fragmento (#propuestas, #pago) pasan
-- el CHECK de notifications.action_url (solo valida el prefijo de path)
-- y la capa app las conserva (sanitizeNotificationActionUrl preserva
-- pathname + search + hash).
--
-- Cambios:
--   1) phase08_route_proposal_event_notification():
--      - propuesta (CREATED/REVISED/ACCEPTED/REJECTED/WITHDRAWN/EXPIRED,
--        DIRECT_BOOKING_CREATED) → /messages/<conv>#propuestas (la página
--        de conversación tiene <section id="propuestas">).
--      - pago (PAYMENT_* / FAKE_PAYMENT_*) → /jobs/<job>#pago cuando ya
--        existe un job para la conversación (jobs.conversation_id); si
--        todavía no hay job (pago previo a la aceptación), fallback a
--        /messages/<conv>#propuestas. La página del trabajo tiene
--        <div id="pago">.
--   2) materialize_due_settlement_reminders(): mantiene el gate del flag
--      payments_online (migración YALO A3) y cambia /jobs/<id> por
--      /jobs/<id>#pago (SETTLEMENT_DUE_REMINDER siempre tiene job_id).

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
  linked_job_id uuid;
  payment_action_url text;
  proposal_action_url text;
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

  proposal_action_url :=
    '/messages/' || proposal_row.conversation_id::text || '#propuestas';

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

    -- El pago puede llegar antes de que exista el trabajo (preautorización
    -- previa a la aceptación): solo se enlaza al job cuando ya hay uno.
    select job.id
    into linked_job_id
    from public.jobs job
    where job.conversation_id = proposal_row.conversation_id
    order by job.created_at desc, job.id desc
    limit 1;

    payment_action_url := case
      when linked_job_id is not null
        then '/jobs/' || linked_job_id::text || '#pago'
      else proposal_action_url
    end;

    perform public.enqueue_user_notification(
      proposal_row.client_user_id,
      'PAYMENT'::public.notification_kind,
      safe_title,
      safe_body,
      payment_action_url,
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
      payment_action_url,
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
      proposal_action_url,
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
      proposal_action_url,
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
      proposal_action_url,
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

revoke all on function public.phase08_route_proposal_event_notification()
from public, anon, authenticated, service_role;

-- YALO A3 (flag payments_online) intacto: sin cobro online no se materializa.
create or replace function public.materialize_due_settlement_reminders(
  effective_now timestamptz default timezone('utc', now())
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  candidate record;
  materialized_count integer := 0;
  online boolean;
begin
  -- YALO A3: sin cobro online no hay deuda exigible que recordar.
  select coalesce(
    (select enabled from public.app_feature_flags where name = 'payments_online'),
    false
  ) into online;
  if not online then
    return 0;
  end if;

  for candidate in
    select
      job.id as job_id,
      job.client_user_id as recipient_user_id
    from public.jobs job
    join public.proposal_versions accepted_version
      on accepted_version.id = job.accepted_proposal_version_id
    where job.status = 'COMPLETED'::public.job_status
      and not public.job_is_settled(job.id)
      and coalesce(accepted_version.price_amount, 0)
        + public.unpaid_scope_additional_for_job(job.id) > 0
      and job.updated_at <= effective_now - interval '72 hours'
    order by job.updated_at, job.id
  loop
    perform public.enqueue_user_notification(
      candidate.recipient_user_id,
      'PAYMENT'::public.notification_kind,
      'Tenés un pago pendiente',
      'El trabajo ya está completo y el cobro sigue pendiente. Abrilo para completar el pago.',
      '/jobs/' || candidate.job_id::text || '#pago',
      'SETTLEMENT_DUE_REMINDER',
      candidate.job_id,
      'job',
      candidate.job_id,
      true,
      true
    );
    materialized_count := materialized_count + 1;
  end loop;

  return materialized_count;
end;
$$;

revoke all on function public.materialize_due_settlement_reminders(timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.materialize_due_settlement_reminders(timestamptz)
to service_role;

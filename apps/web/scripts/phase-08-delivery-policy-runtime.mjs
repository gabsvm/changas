import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase credentials are required for Phase 08 delivery policy checks.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
const runId = crypto.randomUUID();
const password = `Phase08-policy-${runId}-valid-password`;
const users = {
  client: { email: `phase08-policy-client-${runId}@example.test` },
  provider: { email: `phase08-policy-provider-${runId}@example.test` },
};
const HOUR_MS = 60 * 60 * 1000;
const effectiveNow = new Date(Date.now() + 48 * HOUR_MS);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function atEffectiveHour(offsetHours) {
  return new Date(effectiveNow.getTime() + offsetHours * HOUR_MS).toISOString();
}

async function createUser(user) {
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { display_name: user.email.split("@")[0] },
  });
  assert(
    !error && data.user,
    `Could not create ${user.email}: ${error?.message ?? "unknown"}`,
  );
  user.id = data.user.id;
}

async function signIn(user) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password,
  });
  assert(
    !error && data.session,
    `Could not sign in ${user.email}: ${error?.message ?? "unknown"}`,
  );
  return client;
}

async function setPreferences(client, overrides = {}) {
  const requested = {
    requested_push_actionable_enabled: true,
    requested_email_important_enabled: true,
    requested_job_reminders_enabled: true,
    requested_proposal_alerts_enabled: true,
    requested_verification_alerts_enabled: true,
    requested_promotional_enabled: false,
    ...overrides,
  };
  const result = await client.rpc(
    "update_my_notification_preferences",
    requested,
  );
  assert(
    !result.error && result.data?.length === 1,
    `Could not update notification preferences: ${result.error?.message ?? "unknown"}`,
  );
}

async function subscribe(client, label) {
  const endpoint = `https://push.example.test/phase08-policy/${runId}/${label}`;
  const result = await client.rpc("upsert_push_subscription", {
    subscription_endpoint: endpoint,
    subscription_p256dh: `p256dh-${runId}-${label}`,
    subscription_auth: `auth-${runId}-${label}`,
    subscription_user_agent: "Phase 08 delivery policy runtime",
  });
  assert(
    !result.error && result.data,
    `Could not create ${label} push subscription: ${result.error?.message ?? "unknown"}`,
  );
  return endpoint;
}

async function createPaidJob(client, suffix, startHour) {
  const conversation = await client.rpc("start_service_conversation", {
    target_provider_slug: providerSlug,
    target_service_slug: serviceSlug,
  });
  assert(
    !conversation.error && conversation.data,
    `Conversation ${suffix} failed: ${conversation.error?.message ?? "unknown"}`,
  );

  const proposal = await client.rpc("create_conversation_proposal", {
    target_conversation_id: conversation.data,
    requested_kind: "DIRECT_BOOKING",
    scope_text: `Trabajo Phase 08 policy ${suffix}`,
    proposed_price_amount: null,
    proposed_schedule_start_at: atEffectiveHour(startHour),
    proposed_schedule_end_at: atEffectiveHour(startHour + 1),
    proposed_deadline_at: null,
    proposal_expires_at: null,
  });
  assert(
    !proposal.error && proposal.data,
    `Proposal ${suffix} failed: ${proposal.error?.message ?? "unknown"}`,
  );

  const paid = await admin.rpc("apply_fake_payment_result", {
    target_proposal_id: proposal.data,
    payment_nonce: crypto.randomUUID(),
    payment_outcome: "SUCCESS",
    actor_client_user_id: users.client.id,
  });
  assert(
    !paid.error && paid.data?.[0]?.confirmed_job_id,
    `Payment ${suffix} failed: ${paid.error?.message ?? "unknown"}`,
  );

  return {
    conversationId: conversation.data,
    proposalId: proposal.data,
    jobId: paid.data[0].confirmed_job_id,
  };
}

async function transition(
  client,
  jobId,
  expectedStatus,
  requestedStatus,
  reason = null,
) {
  const result = await client.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: expectedStatus,
    requested_status: requestedStatus,
    transition_reason: reason,
  });
  assert(
    !result.error && result.data === requestedStatus,
    `Could not transition ${jobId} to ${requestedStatus}: ${result.error?.message ?? "unknown"}`,
  );
}

async function notificationsFor(filters) {
  let query = admin
    .from("notifications")
    .select(
      "id,recipient_user_id,kind,title,body,action_url,source_event_type,source_event_id,entity_id",
    );
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const result = await query;
  assert(
    !result.error,
    `Could not query notifications: ${result.error?.message ?? "unknown"}`,
  );
  return result.data ?? [];
}

async function channelsFor(notificationIds) {
  if (notificationIds.length === 0) return [];
  const result = await admin
    .from("notification_delivery_outbox")
    .select(
      "id,notification_id,recipient_user_id,channel,status,attempt_count,available_at,last_error_code,lease_token",
    )
    .in("notification_id", notificationIds);
  assert(
    !result.error,
    `Could not query notification outbox: ${result.error?.message ?? "unknown"}`,
  );
  return result.data ?? [];
}

function sortedChannels(rows) {
  return rows.map((row) => row.channel).sort();
}

await Promise.all(Object.values(users).map(createUser));
const [client, provider] = await Promise.all([
  signIn(users.client),
  signIn(users.provider),
]);

const skill = await admin
  .from("skills")
  .select("id")
  .eq("slug", "reparacion-pc")
  .single();
assert(
  !skill.error && skill.data?.id,
  "Phase 08 delivery policy skill fixture is missing.",
);

const providerSlug = `phase08-policy-provider-${runId}`;
const serviceSlug = `phase08-policy-service-${runId}`;
const profile = await admin.from("provider_profiles").insert({
  user_id: users.provider.id,
  status: "ACTIVE",
  onboarding_step: 4,
  public_slug: providerSlug,
  public_headline: "Phase 08 delivery policy provider",
});
assert(
  !profile.error,
  `Could not create provider profile: ${profile.error?.message ?? "unknown"}`,
);
const providerSkill = await admin.from("provider_skills").insert({
  provider_user_id: users.provider.id,
  skill_id: skill.data.id,
  is_featured: true,
});
assert(
  !providerSkill.error,
  `Could not attach provider skill: ${providerSkill.error?.message ?? "unknown"}`,
);
const service = await admin
  .from("services")
  .insert({
    provider_user_id: users.provider.id,
    skill_id: skill.data.id,
    public_slug: serviceSlug,
    title: "Visita técnica Phase 08",
    description:
      "Servicio sintético para validar policy de notificaciones y recordatorios.",
    modality: "IN_PERSON",
    price_model: "FIXED",
    price_amount: 150000,
    currency_code: "ARS",
    accepts_offers: true,
    schedule_type: "FIXED_SLOT",
    expected_duration_minutes: 60,
    is_published: true,
    is_paused: false,
  })
  .select("id")
  .single();
assert(
  !service.error && service.data?.id,
  `Could not create service: ${service.error?.message ?? "unknown"}`,
);

await Promise.all([setPreferences(client), setPreferences(provider)]);
const [clientEndpoint, providerEndpoint] = await Promise.all([
  subscribe(client, "client"),
  subscribe(provider, "provider"),
]);
assert(clientEndpoint !== providerEndpoint, "Push endpoints must be distinct.");

const due = await createPaidJob(client, "due", 4);
const cancelled = await createPaidJob(client, "cancelled", 8);
const completed = await createPaidJob(client, "completed", 12);
const noShow = await createPaidJob(client, "no-show", 16);
const outsideWindow = await createPaidJob(client, "outside-window", 30);

await transition(
  client,
  cancelled.jobId,
  "CONFIRMED",
  "CANCELLED",
  "Cancelado para validar recordatorios",
);
await transition(
  client,
  noShow.jobId,
  "CONFIRMED",
  "NO_SHOW",
  "Ausencia para validar recordatorios",
);
await transition(provider, completed.jobId, "CONFIRMED", "IN_PROGRESS");
await transition(
  provider,
  completed.jobId,
  "IN_PROGRESS",
  "COMPLETION_REQUESTED",
);
await transition(client, completed.jobId, "COMPLETION_REQUESTED", "COMPLETED");

const privateAddress = `Av. Privada ${runId} 1234, CABA`;
const exactLocation = await client.rpc("set_job_exact_location", {
  target_job_id: due.jobId,
  exact_address_text: privateAddress,
  lat: -34.6037,
  lng: -58.3816,
  notes: `Acceso privado ${runId}`,
});
assert(
  !exactLocation.error,
  `Could not set private Job location: ${exactLocation.error?.message ?? "unknown"}`,
);

const firstReminderRun = await admin.rpc("materialize_due_job_reminders", {
  effective_now: effectiveNow.toISOString(),
});
assert(
  !firstReminderRun.error,
  `Reminder materialization failed: ${firstReminderRun.error?.message ?? "unknown"}`,
);

const reminderRows = await notificationsFor({
  source_event_type: "JOB_REMINDER_24H",
});
const ownReminderRows = reminderRows.filter((row) =>
  [users.client.id, users.provider.id].includes(row.recipient_user_id),
);
assert(
  ownReminderRows.length === 2 &&
    ownReminderRows.every((row) => row.entity_id === due.jobId),
  "Reminder policy included an outside-window, cancelled, completed or no-show Job.",
);
assert(
  ownReminderRows.every(
    (row) =>
      row.title === "Tenés un trabajo próximo" &&
      row.body === "Revisá los detalles actualizados del trabajo en Changas." &&
      row.action_url === `/jobs/${due.jobId}` &&
      !row.title.includes(privateAddress) &&
      !row.body.includes(privateAddress),
  ),
  "Reminder copy leaked private Job details or lost its safe action URL.",
);
const firstReminderOutbox = await channelsFor(
  ownReminderRows.map((row) => row.id),
);
assert(
  JSON.stringify(sortedChannels(firstReminderOutbox)) ===
    JSON.stringify(["EMAIL", "EMAIL", "PUSH", "PUSH"]),
  "Due Job reminder did not create the configured push and email channels.",
);

const secondReminderRun = await admin.rpc("materialize_due_job_reminders", {
  effective_now: effectiveNow.toISOString(),
});
assert(
  !secondReminderRun.error,
  `Second reminder materialization failed: ${secondReminderRun.error?.message ?? "unknown"}`,
);
const repeatedReminderRows = (
  await notificationsFor({ source_event_type: "JOB_REMINDER_24H" })
).filter((row) =>
  [users.client.id, users.provider.id].includes(row.recipient_user_id),
);
const repeatedReminderOutbox = await channelsFor(
  repeatedReminderRows.map((row) => row.id),
);
assert(
  repeatedReminderRows.length === 2 && repeatedReminderOutbox.length === 4,
  "Reminder materialization was not idempotent by schedule version and recipient.",
);

await setPreferences(client, {
  requested_job_reminders_enabled: false,
});
const preferenceJob = await createPaidJob(client, "preference-disabled", 18);
const preferenceReminderRun = await admin.rpc("materialize_due_job_reminders", {
  effective_now: effectiveNow.toISOString(),
});
assert(
  !preferenceReminderRun.error,
  `Preference-aware reminder run failed: ${preferenceReminderRun.error?.message ?? "unknown"}`,
);
const preferenceReminders = await notificationsFor({
  source_event_type: "JOB_REMINDER_24H",
  entity_id: preferenceJob.jobId,
});
assert(
  preferenceReminders.length === 1 &&
    preferenceReminders[0].recipient_user_id === users.provider.id,
  "Disabling Job reminders did not suppress the client's reminder while preserving the provider reminder.",
);
await setPreferences(client);

const proposalNotifications = await notificationsFor({
  kind: "PROPOSAL",
  source_event_type: "DIRECT_BOOKING_CREATED",
  entity_id: due.proposalId,
  recipient_user_id: users.provider.id,
});
assert(
  proposalNotifications.length === 1,
  "Direct booking did not create exactly one provider proposal notification.",
);
const proposalOutbox = await channelsFor([proposalNotifications[0].id]);
assert(
  JSON.stringify(sortedChannels(proposalOutbox)) ===
    JSON.stringify(["EMAIL", "PUSH"]),
  "Actionable proposal did not honor configured push and email channels.",
);

const privateMessage = `Mensaje privado ${runId}: no debe salir del chat.`;
const sentMessage = await client.rpc("send_conversation_text", {
  target_conversation_id: due.conversationId,
  message_body: privateMessage,
  message_nonce: crypto.randomUUID(),
});
assert(
  !sentMessage.error && sentMessage.data,
  `Could not send policy message: ${sentMessage.error?.message ?? "unknown"}`,
);
const messageNotifications = await notificationsFor({
  kind: "MESSAGE",
  source_event_type: "MESSAGE_CREATED",
  source_event_id: sentMessage.data,
  recipient_user_id: users.provider.id,
});
assert(
  messageNotifications.length === 1 &&
    messageNotifications[0].title === "Nuevo mensaje" &&
    messageNotifications[0].body === "Tenés un mensaje nuevo en Changas." &&
    !messageNotifications[0].body.includes(privateMessage),
  "Message notification leaked chat text or lost its generic copy.",
);
const messageOutbox = await channelsFor([messageNotifications[0].id]);
assert(
  messageOutbox.length === 0,
  "A trivial chat message escaped the in-app-only delivery policy.",
);

const reviewText = `Reseña privada de runtime ${runId}`;
const createdReview = await client.rpc("create_job_review", {
  target_job_id: completed.jobId,
  requested_rating: 5,
  requested_review_text: reviewText,
  requested_quality_rating: 5,
  requested_punctuality_rating: 5,
  requested_communication_rating: 5,
});
assert(
  !createdReview.error && createdReview.data,
  `Could not create verified review: ${createdReview.error?.message ?? "unknown"}`,
);
const reviewNotifications = await notificationsFor({
  kind: "REVIEW",
  source_event_type: "REVIEW_CREATED",
  source_event_id: createdReview.data,
  recipient_user_id: users.provider.id,
});
assert(
  reviewNotifications.length === 1 &&
    !reviewNotifications[0].title.includes(reviewText) &&
    !reviewNotifications[0].body.includes(reviewText),
  "Review notification leaked review text or was not routed to the provider.",
);
const reviewOutbox = await channelsFor([reviewNotifications[0].id]);
assert(
  JSON.stringify(sortedChannels(reviewOutbox)) === JSON.stringify(["PUSH"]),
  "Review policy must use push when enabled without generating an email.",
);

const noSubscriptionJob = await createPaidJob(client, "no-subscription", 20);
const removedSubscription = await client.rpc("delete_push_subscription", {
  subscription_endpoint: clientEndpoint,
});
assert(
  !removedSubscription.error && removedSubscription.data === true,
  `Could not remove client push subscription: ${removedSubscription.error?.message ?? "unknown"}`,
);
await transition(provider, noSubscriptionJob.jobId, "CONFIRMED", "IN_PROGRESS");
const noSubscriptionNotifications = await notificationsFor({
  kind: "JOB",
  source_event_type: "JOB_STATUS_CHANGED:IN_PROGRESS",
  entity_id: noSubscriptionJob.jobId,
  recipient_user_id: users.client.id,
});
assert(
  noSubscriptionNotifications.length === 1,
  "Job mutation failed to create its in-app notification without a push subscription.",
);
const noSubscriptionOutbox = await channelsFor([
  noSubscriptionNotifications[0].id,
]);
assert(
  JSON.stringify(sortedChannels(noSubscriptionOutbox)) ===
    JSON.stringify(["EMAIL"]),
  "Missing push subscription should skip push while preserving the configured email channel.",
);

const claimed = await admin.rpc("claim_notification_deliveries_v2", {
  requested_batch_size: 100,
  requested_lease_seconds: 120,
});
assert(
  !claimed.error && claimed.data?.length,
  `Could not claim delivery policy rows: ${claimed.error?.message ?? "unknown"}`,
);
const retryTarget = claimed.data.find(
  (row) =>
    row.notification_id === noSubscriptionNotifications[0].id &&
    row.channel === "EMAIL",
);
assert(retryTarget, "Could not claim the no-subscription email delivery.");
const recordedRetry = await admin.rpc("record_notification_delivery_result", {
  target_delivery_id: retryTarget.delivery_id,
  target_lease_token: retryTarget.lease_token,
  delivery_succeeded: false,
  delivery_retryable: true,
  delivery_error_code: "EMAIL_PROVIDER_UNCONFIGURED",
});
assert(
  !recordedRetry.error && recordedRetry.data === true,
  `Could not record controlled provider retry: ${recordedRetry.error?.message ?? "unknown"}`,
);
const retryState = await admin
  .from("notification_delivery_outbox")
  .select("status,attempt_count,available_at,last_error_code,lease_token")
  .eq("id", retryTarget.delivery_id)
  .single();
assert(
  !retryState.error &&
    retryState.data?.status === "PENDING" &&
    retryState.data?.attempt_count >= 1 &&
    retryState.data?.last_error_code === "EMAIL_PROVIDER_UNCONFIGURED" &&
    retryState.data?.lease_token === null &&
    new Date(retryState.data.available_at).getTime() > Date.now(),
  "Retryable provider failure did not return the delivery to a controlled backoff state.",
);

const rejectedProfile = await admin
  .from("provider_profiles")
  .update({ status: "REJECTED" })
  .eq("user_id", users.provider.id);
assert(
  !rejectedProfile.error,
  `Could not trigger provider verification routing: ${rejectedProfile.error?.message ?? "unknown"}`,
);
const verificationNotifications = await notificationsFor({
  kind: "VERIFICATION",
  source_event_type: "PROVIDER_VERIFICATION_REJECTED",
  recipient_user_id: users.provider.id,
});
assert(
  verificationNotifications.length === 1,
  "Provider verification change did not create exactly one safe notification.",
);
const verificationOutbox = await channelsFor([verificationNotifications[0].id]);
assert(
  JSON.stringify(sortedChannels(verificationOutbox)) ===
    JSON.stringify(["EMAIL", "PUSH"]),
  "Verification alert did not honor configured actionable channels.",
);

assert(
  outsideWindow.jobId !== due.jobId && providerEndpoint.startsWith("https://"),
  "Delivery policy fixtures were not isolated correctly.",
);

console.log("Phase 08 delivery policy runtime checks: PASS");

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase credentials are required for Phase 06 runtime checks.",
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
const password = `Phase06-${runId}-valid-password`;
const users = {
  clientA: { email: `phase06-a-${runId}@example.test` },
  clientB: { email: `phase06-b-${runId}@example.test` },
  provider: { email: `phase06-provider-${runId}@example.test` },
  outsider: { email: `phase06-outsider-${runId}@example.test` },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    `Could not create user: ${error?.message ?? "unknown"}`,
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

await Promise.all(Object.values(users).map(createUser));
const [clientA, clientB, provider, outsider] = await Promise.all([
  signIn(users.clientA),
  signIn(users.clientB),
  signIn(users.provider),
  signIn(users.outsider),
]);

const skill = await admin
  .from("skills")
  .select("id")
  .eq("slug", "reparacion-pc")
  .single();
assert(
  !skill.error && skill.data?.id,
  "Phase 06 runtime skill fixture is missing.",
);

const providerSlug = `phase06-provider-${runId}`;
const serviceSlug = `phase06-service-${runId}`;
assert(
  !(
    await admin.from("provider_profiles").insert({
      user_id: users.provider.id,
      status: "ACTIVE",
      onboarding_step: 4,
      public_slug: providerSlug,
      public_headline: "Phase 06 runtime provider",
    })
  ).error,
  "Could not create provider profile.",
);
assert(
  !(
    await admin.from("provider_skills").insert({
      provider_user_id: users.provider.id,
      skill_id: skill.data.id,
      is_featured: true,
    })
  ).error,
  "Could not attach provider skill.",
);
const service = await admin
  .from("services")
  .insert({
    provider_user_id: users.provider.id,
    skill_id: skill.data.id,
    public_slug: serviceSlug,
    title: "Diagnóstico presencial Phase 06",
    description:
      "Servicio sintético para validar agenda, ejecución, cambios de alcance y privacidad.",
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

const slotStart = "2026-09-04T15:00:00.000Z";
const slotEnd = "2026-09-04T16:00:00.000Z";

async function createPaidJob(client, clientUser, suffix, startAt, endAt) {
  const started = await client.rpc("start_service_conversation", {
    target_provider_slug: providerSlug,
    target_service_slug: serviceSlug,
  });
  assert(
    !started.error && started.data,
    `Conversation ${suffix} failed: ${started.error?.message ?? "unknown"}`,
  );
  const proposal = await client.rpc("create_conversation_proposal", {
    target_conversation_id: started.data,
    requested_kind: "DIRECT_BOOKING",
    scope_text: `Trabajo Phase 06 ${suffix}`,
    proposed_price_amount: null,
    proposed_schedule_start_at: startAt,
    proposed_schedule_end_at: endAt,
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
    actor_client_user_id: clientUser.id,
  });
  return { conversationId: started.data, proposalId: proposal.data, paid };
}

async function requestAcceptedScopeChange(jobId, scopeText, amountMinor) {
  const requested = await provider.rpc("request_job_scope_change", {
    target_job_id: jobId,
    new_scope_text: scopeText,
    additional_amount_minor: amountMinor,
  });
  assert(
    !requested.error && requested.data,
    `Scope change request failed: ${requested.error?.message ?? "unknown"}`,
  );
  const accepted = await clientA.rpc("respond_job_scope_change", {
    target_scope_change_id: requested.data,
    response_action: "ACCEPT",
  });
  assert(
    !accepted.error && accepted.data === "AWAITING_PAYMENT",
    "Price-increasing scope change bypassed additional payment state.",
  );
  return requested.data;
}

async function applyAdditionalPayment({
  scopeChangeId,
  nonce,
  providerReference,
  status,
}) {
  return admin.rpc("apply_additional_payment_result", {
    target_scope_change_id: scopeChangeId,
    payment_nonce: nonce,
    payment_provider_name: "RUNTIME",
    payment_provider_reference: providerReference,
    payment_result_status: status,
    actor_client_user_id: users.clientA.id,
  });
}

const first = await createPaidJob(
  clientA,
  users.clientA,
  "A",
  slotStart,
  slotEnd,
);
assert(
  !first.paid.error && first.paid.data?.[0]?.confirmed_job_id,
  `First job payment failed: ${first.paid.error?.message ?? "unknown"}`,
);
const jobId = first.paid.data[0].confirmed_job_id;

const conflicting = await createPaidJob(
  clientB,
  users.clientB,
  "B",
  slotStart,
  slotEnd,
);
assert(
  Boolean(conflicting.paid.error),
  "Overlapping provider booking produced a second confirmed job.",
);
const conflictingJobs = await admin
  .from("jobs")
  .select("id")
  .eq("client_user_id", users.clientB.id);
assert(
  !conflictingJobs.error && conflictingJobs.data?.length === 0,
  "Conflicting fake payment persisted a job despite booking exclusion.",
);

const outsiderDetail = await outsider.rpc("get_job_detail", {
  target_job_id: jobId,
});
assert(Boolean(outsiderDetail.error), "Outsider can inspect a private job.");

const location = await clientA.rpc("set_job_exact_location", {
  target_job_id: jobId,
  exact_address_text: "Av. Corrientes 1234, CABA",
  lat: -34.6037,
  lng: -58.3816,
  notes: "Timbre 4B",
});
assert(
  !location.error,
  `Client could not set exact location: ${location.error?.message ?? "unknown"}`,
);
const providerDetail = await provider.rpc("get_job_detail", {
  target_job_id: jobId,
});
assert(
  !providerDetail.error &&
    providerDetail.data?.[0]?.exact_address === "Av. Corrientes 1234, CABA",
  "Confirmed provider cannot see contractual exact location.",
);

const reschedule = await clientA.rpc("request_job_reschedule", {
  target_job_id: jobId,
  requested_schedule_type: "FIXED_SLOT",
  requested_starts_at: "2026-09-05T15:00:00.000Z",
  requested_ends_at: "2026-09-05T16:00:00.000Z",
  requested_deadline_at: null,
  requested_duration_minutes: 60,
  request_reason: "Cambio de disponibilidad del cliente",
});
assert(
  !reschedule.error && reschedule.data,
  `Reschedule request failed: ${reschedule.error?.message ?? "unknown"}`,
);
const acceptedReschedule = await provider.rpc("respond_job_reschedule", {
  target_request_id: reschedule.data,
  response_action: "ACCEPT",
});
assert(
  !acceptedReschedule.error && acceptedReschedule.data === "ACCEPTED",
  `Reschedule acceptance failed: ${acceptedReschedule.error?.message ?? "unknown"}`,
);

const rejectedReschedule = await provider.rpc("request_job_reschedule", {
  target_job_id: jobId,
  requested_schedule_type: "FIXED_SLOT",
  requested_starts_at: "2026-09-05T16:00:00.000Z",
  requested_ends_at: "2026-09-05T17:00:00.000Z",
  requested_deadline_at: null,
  requested_duration_minutes: 60,
  request_reason: "Segunda alternativa del proveedor",
});
assert(
  !rejectedReschedule.error && rejectedReschedule.data,
  "Provider could not request a second reschedule.",
);
const rejectedRescheduleResponse = await clientA.rpc("respond_job_reschedule", {
  target_request_id: rejectedReschedule.data,
  response_action: "REJECT",
});
assert(
  !rejectedRescheduleResponse.error &&
    rejectedRescheduleResponse.data === "REJECTED",
  "Client could not reject a reschedule request.",
);

const scheduleHistory = await admin
  .from("job_schedule_versions")
  .select("id,version_number")
  .eq("job_id", jobId);
assert(
  !scheduleHistory.error && scheduleHistory.data?.length === 2,
  "Accepted reschedule did not preserve schedule history.",
);
const rescheduleHistory = await clientA.rpc("list_job_reschedule_requests", {
  target_job_id: jobId,
});
assert(
  !rescheduleHistory.error &&
    rescheduleHistory.data?.some(
      (request) => request.request_status === "ACCEPTED",
    ) &&
    rescheduleHistory.data?.some(
      (request) => request.request_status === "REJECTED",
    ),
  "Reschedule history did not preserve accepted and rejected requests.",
);

const scopeChange = await requestAcceptedScopeChange(
  jobId,
  "Diagnóstico más limpieza interna y recambio preventivo del cooler.",
  50000,
);
const additional = await admin.rpc("apply_fake_additional_payment_result", {
  target_scope_change_id: scopeChange,
  payment_nonce: crypto.randomUUID(),
  payment_outcome: "SUCCESS",
  actor_client_user_id: users.clientA.id,
});
assert(
  !additional.error &&
    additional.data?.[0]?.resulting_scope_change_status === "PAID",
  `Additional fake payment failed: ${additional.error?.message ?? "unknown"}`,
);

const retryScopeChange = await requestAcceptedScopeChange(
  jobId,
  "Segundo adicional para validar pending, failure y retry.",
  30000,
);
const pendingNonce = crypto.randomUUID();
const pendingReference = `additional-pending-${crypto.randomUUID()}`;
const pendingAdditional = await applyAdditionalPayment({
  scopeChangeId: retryScopeChange,
  nonce: pendingNonce,
  providerReference: pendingReference,
  status: "PENDING",
});
assert(
  !pendingAdditional.error &&
    pendingAdditional.data?.[0]?.resulting_scope_change_status ===
      "AWAITING_PAYMENT",
  "Generic additional PENDING did not retain AWAITING_PAYMENT.",
);
const duplicatePending = await applyAdditionalPayment({
  scopeChangeId: retryScopeChange,
  nonce: pendingNonce,
  providerReference: pendingReference,
  status: "PENDING",
});
assert(
  !duplicatePending.error &&
    duplicatePending.data?.[0]?.payment_attempt_id ===
      pendingAdditional.data?.[0]?.payment_attempt_id,
  "Duplicate additional payment nonce created a different attempt.",
);
const failedAdditional = await applyAdditionalPayment({
  scopeChangeId: retryScopeChange,
  nonce: crypto.randomUUID(),
  providerReference: `additional-failed-${crypto.randomUUID()}`,
  status: "FAILED",
});
assert(
  !failedAdditional.error &&
    failedAdditional.data?.[0]?.resulting_scope_change_status ===
      "PAYMENT_FAILED",
  "Generic additional FAILURE did not enter PAYMENT_FAILED.",
);
const retryAdditional = await applyAdditionalPayment({
  scopeChangeId: retryScopeChange,
  nonce: crypto.randomUUID(),
  providerReference: `additional-retry-${crypto.randomUUID()}`,
  status: "SUCCEEDED",
});
assert(
  !retryAdditional.error &&
    retryAdditional.data?.[0]?.resulting_scope_change_status === "PAID",
  "New-nonce additional payment retry did not recover to PAID.",
);

const concurrentScopeChange = await requestAcceptedScopeChange(
  jobId,
  "Tercer adicional para validar callbacks concurrentes idempotentes.",
  20000,
);
const concurrentNonce = crypto.randomUUID();
const concurrentReference = `additional-race-${crypto.randomUUID()}`;
const [concurrentA, concurrentB] = await Promise.all([
  applyAdditionalPayment({
    scopeChangeId: concurrentScopeChange,
    nonce: concurrentNonce,
    providerReference: concurrentReference,
    status: "SUCCEEDED",
  }),
  applyAdditionalPayment({
    scopeChangeId: concurrentScopeChange,
    nonce: concurrentNonce,
    providerReference: concurrentReference,
    status: "SUCCEEDED",
  }),
]);
assert(
  !concurrentA.error &&
    !concurrentB.error &&
    concurrentA.data?.[0]?.payment_attempt_id ===
      concurrentB.data?.[0]?.payment_attempt_id &&
    concurrentA.data?.[0]?.resulting_scope_change_status === "PAID" &&
    concurrentB.data?.[0]?.resulting_scope_change_status === "PAID",
  "Concurrent duplicate additional payment callbacks were not idempotent.",
);
const concurrentAttempts = await admin
  .from("job_additional_payment_attempts")
  .select("id")
  .eq("scope_change_id", concurrentScopeChange);
assert(
  !concurrentAttempts.error && concurrentAttempts.data?.length === 1,
  "Concurrent duplicate callbacks persisted more than one additional payment attempt.",
);
const additionalSuccessEvents = await admin
  .from("job_events")
  .select("metadata")
  .eq("job_id", jobId)
  .eq("event_type", "ADDITIONAL_PAYMENT_SUCCEEDED");
const concurrentSuccessEvents = (additionalSuccessEvents.data ?? []).filter(
  (event) => event.metadata?.scope_change_id === concurrentScopeChange,
);
assert(
  !additionalSuccessEvents.error && concurrentSuccessEvents.length === 1,
  "Concurrent duplicate callbacks emitted duplicate success events.",
);

const illegalClientStart = await clientA.rpc("transition_job_status", {
  target_job_id: jobId,
  expected_status: "CONFIRMED",
  requested_status: "IN_PROGRESS",
  transition_reason: null,
});
assert(Boolean(illegalClientStart.error), "Client can start provider work.");

const startedJob = await provider.rpc("transition_job_status", {
  target_job_id: jobId,
  expected_status: "CONFIRMED",
  requested_status: "IN_PROGRESS",
  transition_reason: null,
});
assert(
  !startedJob.error && startedJob.data === "IN_PROGRESS",
  `Provider start failed: ${startedJob.error?.message ?? "unknown"}`,
);
const completionRequest = await provider.rpc("transition_job_status", {
  target_job_id: jobId,
  expected_status: "IN_PROGRESS",
  requested_status: "COMPLETION_REQUESTED",
  transition_reason: null,
});
assert(
  !completionRequest.error && completionRequest.data === "COMPLETION_REQUESTED",
  "Provider could not request completion.",
);
const illegalProviderCompletion = await provider.rpc("transition_job_status", {
  target_job_id: jobId,
  expected_status: "COMPLETION_REQUESTED",
  requested_status: "COMPLETED",
  transition_reason: null,
});
assert(
  Boolean(illegalProviderCompletion.error),
  "Provider can confirm their own completion request.",
);
const completed = await clientA.rpc("transition_job_status", {
  target_job_id: jobId,
  expected_status: "COMPLETION_REQUESTED",
  requested_status: "COMPLETED",
  transition_reason: null,
});
assert(
  !completed.error && completed.data === "COMPLETED",
  "Client could not complete job.",
);

const providerAfterCompletion = await provider.rpc("get_job_detail", {
  target_job_id: jobId,
});
assert(
  !providerAfterCompletion.error &&
    providerAfterCompletion.data?.[0]?.exact_address === null,
  "Provider retained exact address through the participant read model after completion.",
);

const cancelledFixture = await createPaidJob(
  clientB,
  users.clientB,
  "cancelled",
  "2026-09-06T14:00:00.000Z",
  "2026-09-06T15:00:00.000Z",
);
const cancelledJobId = cancelledFixture.paid.data?.[0]?.confirmed_job_id;
assert(
  !cancelledFixture.paid.error && cancelledJobId,
  "Could not create cancellation audit fixture.",
);
const cancellationReason = "El cliente canceló antes de la visita acordada.";
const cancelled = await clientB.rpc("transition_job_status", {
  target_job_id: cancelledJobId,
  expected_status: "CONFIRMED",
  requested_status: "CANCELLED",
  transition_reason: cancellationReason,
});
assert(
  !cancelled.error && cancelled.data === "CANCELLED",
  "Client could not cancel a confirmed Job with a reason.",
);
const cancellationEvents = await clientB.rpc("list_job_events", {
  target_job_id: cancelledJobId,
  limit_count: 200,
});
const cancellationEvent = cancellationEvents.data?.find(
  (event) => event.to_status === "CANCELLED",
);
assert(
  !cancellationEvents.error &&
    cancellationEvent?.actor_user_id === users.clientB.id &&
    cancellationEvent?.reason === cancellationReason,
  "Cancellation audit did not preserve actor and reason.",
);

const noShowFixture = await createPaidJob(
  clientA,
  users.clientA,
  "no-show",
  "2026-09-06T15:00:00.000Z",
  "2026-09-06T16:00:00.000Z",
);
const noShowJobId = noShowFixture.paid.data?.[0]?.confirmed_job_id;
assert(
  !noShowFixture.paid.error && noShowJobId,
  "Could not create no-show audit fixture.",
);
const noShowReason = "El cliente no se presentó en el horario confirmado.";
const noShow = await provider.rpc("transition_job_status", {
  target_job_id: noShowJobId,
  expected_status: "CONFIRMED",
  requested_status: "NO_SHOW",
  transition_reason: noShowReason,
});
assert(
  !noShow.error && noShow.data === "NO_SHOW",
  "Provider could not record a confirmed Job no-show.",
);
const noShowEvents = await provider.rpc("list_job_events", {
  target_job_id: noShowJobId,
  limit_count: 200,
});
const noShowEvent = noShowEvents.data?.find(
  (event) => event.to_status === "NO_SHOW",
);
assert(
  !noShowEvents.error &&
    noShowEvent?.actor_user_id === users.provider.id &&
    noShowEvent?.reason === noShowReason,
  "No-show audit did not preserve actor and reason.",
);

const events = await clientA.rpc("list_job_events", {
  target_job_id: jobId,
  limit_count: 200,
});
assert(
  !events.error &&
    events.data?.some((event) => event.event_type === "RESCHEDULE_ACCEPTED"),
  "Job event history lost accepted reschedule.",
);
assert(
  events.data?.some((event) => event.event_type === "RESCHEDULE_REJECTED"),
  "Job event history lost rejected reschedule.",
);
assert(
  events.data?.some((event) => event.event_type === "SCOPE_CHANGE_ACCEPTED"),
  "Job event history lost accepted scope change.",
);
assert(
  events.data?.some((event) => event.to_status === "COMPLETED"),
  "Job event history lost completion transition.",
);

console.log("Phase 06 jobs runtime security checks: PASS");

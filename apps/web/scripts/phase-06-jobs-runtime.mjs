import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Local Supabase credentials are required for Phase 06 runtime checks.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
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
  assert(!error && data.user, `Could not create user: ${error?.message ?? "unknown"}`);
  user.id = data.user.id;
}

async function signIn(user) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password });
  assert(!error && data.session, `Could not sign in ${user.email}: ${error?.message ?? "unknown"}`);
  return client;
}

await Promise.all(Object.values(users).map(createUser));
const [clientA, clientB, provider, outsider] = await Promise.all([
  signIn(users.clientA),
  signIn(users.clientB),
  signIn(users.provider),
  signIn(users.outsider),
]);

const skill = await admin.from("skills").select("id").eq("slug", "reparacion-pc").single();
assert(!skill.error && skill.data?.id, "Phase 06 runtime skill fixture is missing.");

const providerSlug = `phase06-provider-${runId}`;
const serviceSlug = `phase06-service-${runId}`;
assert(
  !(await admin.from("provider_profiles").insert({
    user_id: users.provider.id,
    status: "ACTIVE",
    onboarding_step: 4,
    public_slug: providerSlug,
    public_headline: "Phase 06 runtime provider",
  })).error,
  "Could not create provider profile.",
);
assert(
  !(await admin.from("provider_skills").insert({
    provider_user_id: users.provider.id,
    skill_id: skill.data.id,
    is_featured: true,
  })).error,
  "Could not attach provider skill.",
);
const service = await admin
  .from("services")
  .insert({
    provider_user_id: users.provider.id,
    skill_id: skill.data.id,
    public_slug: serviceSlug,
    title: "Diagnóstico presencial Phase 06",
    description: "Servicio sintético para validar agenda, ejecución, cambios de alcance y privacidad.",
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
assert(!service.error && service.data?.id, `Could not create service: ${service.error?.message ?? "unknown"}`);

const slotStart = "2026-09-04T15:00:00.000Z";
const slotEnd = "2026-09-04T16:00:00.000Z";

async function createPaidJob(client, clientUser, suffix, startAt, endAt) {
  const started = await client.rpc("start_service_conversation", {
    target_provider_slug: providerSlug,
    target_service_slug: serviceSlug,
  });
  assert(!started.error && started.data, `Conversation ${suffix} failed: ${started.error?.message ?? "unknown"}`);
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
  assert(!proposal.error && proposal.data, `Proposal ${suffix} failed: ${proposal.error?.message ?? "unknown"}`);
  const paid = await admin.rpc("apply_fake_payment_result", {
    target_proposal_id: proposal.data,
    payment_nonce: crypto.randomUUID(),
    payment_outcome: "SUCCESS",
    actor_client_user_id: clientUser.id,
  });
  return { conversationId: started.data, proposalId: proposal.data, paid };
}

const first = await createPaidJob(clientA, users.clientA, "A", slotStart, slotEnd);
assert(!first.paid.error && first.paid.data?.[0]?.confirmed_job_id, `First job payment failed: ${first.paid.error?.message ?? "unknown"}`);
const jobId = first.paid.data[0].confirmed_job_id;

const conflicting = await createPaidJob(clientB, users.clientB, "B", slotStart, slotEnd);
assert(Boolean(conflicting.paid.error), "Overlapping provider booking produced a second confirmed job.");
const conflictingJobs = await admin.from("jobs").select("id").eq("client_user_id", users.clientB.id);
assert(!conflictingJobs.error && conflictingJobs.data?.length === 0, "Conflicting fake payment persisted a job despite booking exclusion.");

const outsiderDetail = await outsider.rpc("get_job_detail", { target_job_id: jobId });
assert(Boolean(outsiderDetail.error), "Outsider can inspect a private job.");

const location = await clientA.rpc("set_job_exact_location", {
  target_job_id: jobId,
  exact_address_text: "Av. Corrientes 1234, CABA",
  lat: -34.6037,
  lng: -58.3816,
  notes: "Timbre 4B",
});
assert(!location.error, `Client could not set exact location: ${location.error?.message ?? "unknown"}`);
const providerDetail = await provider.rpc("get_job_detail", { target_job_id: jobId });
assert(!providerDetail.error && providerDetail.data?.[0]?.exact_address === "Av. Corrientes 1234, CABA", "Confirmed provider cannot see contractual exact location.");

const reschedule = await clientA.rpc("request_job_reschedule", {
  target_job_id: jobId,
  requested_schedule_type: "FIXED_SLOT",
  requested_starts_at: "2026-09-05T15:00:00.000Z",
  requested_ends_at: "2026-09-05T16:00:00.000Z",
  requested_deadline_at: null,
  requested_duration_minutes: 60,
  request_reason: "Cambio de disponibilidad del cliente",
});
assert(!reschedule.error && reschedule.data, `Reschedule request failed: ${reschedule.error?.message ?? "unknown"}`);
const acceptedReschedule = await provider.rpc("respond_job_reschedule", {
  target_request_id: reschedule.data,
  response_action: "ACCEPT",
});
assert(!acceptedReschedule.error && acceptedReschedule.data === "ACCEPTED", `Reschedule acceptance failed: ${acceptedReschedule.error?.message ?? "unknown"}`);
const scheduleHistory = await admin.from("job_schedule_versions").select("id,version_number").eq("job_id", jobId);
assert(!scheduleHistory.error && scheduleHistory.data?.length === 2, "Accepted reschedule did not preserve schedule history.");

const scopeChange = await provider.rpc("request_job_scope_change", {
  target_job_id: jobId,
  new_scope_text: "Diagnóstico más limpieza interna y recambio preventivo del cooler.",
  additional_amount_minor: 50000,
});
assert(!scopeChange.error && scopeChange.data, `Scope change request failed: ${scopeChange.error?.message ?? "unknown"}`);
const acceptedScope = await clientA.rpc("respond_job_scope_change", {
  target_scope_change_id: scopeChange.data,
  response_action: "ACCEPT",
});
assert(!acceptedScope.error && acceptedScope.data === "AWAITING_PAYMENT", "Price-increasing scope change bypassed additional payment state.");
const additional = await admin.rpc("apply_fake_additional_payment_result", {
  target_scope_change_id: scopeChange.data,
  payment_nonce: crypto.randomUUID(),
  payment_outcome: "SUCCESS",
  actor_client_user_id: users.clientA.id,
});
assert(!additional.error && additional.data?.[0]?.resulting_scope_change_status === "PAID", `Additional fake payment failed: ${additional.error?.message ?? "unknown"}`);

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
assert(!startedJob.error && startedJob.data === "IN_PROGRESS", `Provider start failed: ${startedJob.error?.message ?? "unknown"}`);
const completionRequest = await provider.rpc("transition_job_status", {
  target_job_id: jobId,
  expected_status: "IN_PROGRESS",
  requested_status: "COMPLETION_REQUESTED",
  transition_reason: null,
});
assert(!completionRequest.error && completionRequest.data === "COMPLETION_REQUESTED", "Provider could not request completion.");
const completed = await clientA.rpc("transition_job_status", {
  target_job_id: jobId,
  expected_status: "COMPLETION_REQUESTED",
  requested_status: "COMPLETED",
  transition_reason: null,
});
assert(!completed.error && completed.data === "COMPLETED", "Client could not complete job.");

const providerAfterCompletion = await provider.rpc("get_job_detail", { target_job_id: jobId });
assert(!providerAfterCompletion.error && providerAfterCompletion.data?.[0]?.exact_address === null, "Provider retained exact address through the participant read model after completion.");

const events = await clientA.rpc("list_job_events", { target_job_id: jobId, limit_count: 200 });
assert(!events.error && events.data?.some((event) => event.event_type === "RESCHEDULE_ACCEPTED"), "Job event history lost accepted reschedule.");
assert(events.data?.some((event) => event.event_type === "SCOPE_CHANGE_ACCEPTED"), "Job event history lost accepted scope change.");
assert(events.data?.some((event) => event.to_status === "COMPLETED"), "Job event history lost completion transition.");

console.log("Phase 06 jobs runtime security checks: PASS");

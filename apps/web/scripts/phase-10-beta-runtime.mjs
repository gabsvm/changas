import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase API_URL, ANON_KEY, and SERVICE_ROLE_KEY are required for Phase 10 runtime checks.",
  );
}

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const anonymous = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const runId = crypto.randomUUID();
const compactRunId = runId.replaceAll("-", "");
const password = `Phase10-${runId}-ValidPassword!`;
const users = {
  admin: { email: `phase10-admin-${runId}@example.test` },
  client: { email: `phase10-client-${runId}@example.test` },
  rival: { email: `phase10-rival-${runId}@example.test` },
  remoteProvider: { email: `phase10-remote-${runId}@example.test` },
  localProvider: { email: `phase10-local-${runId}@example.test` },
  outsider: { email: `phase10-outsider-${runId}@example.test` },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function step(name) {
  console.log(`Phase 10 :: ${name}`);
}

async function createUser(user) {
  const { data, error } = await service.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { display_name: user.email.split("@")[0] },
  });
  assert(!error && data.user, `Could not create ${user.email}: ${error?.message ?? "unknown"}`);
  user.id = data.user.id;
}

async function signIn(user) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password,
  });
  assert(!error && data.session, `Could not sign in ${user.email}: ${error?.message ?? "unknown"}`);
  return client;
}

function fixedWindow(daysFromNow, hour = 14) {
  const start = new Date(Date.now() + daysFromNow * 86_400_000);
  start.setUTCHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function getSkill(slug) {
  const result = await service.from("skills").select("id").eq("slug", slug).single();
  assert(!result.error && result.data?.id, `Missing Phase 10 catalog skill ${slug}`);
  return result.data.id;
}

async function onboardAndVerifyProvider({ user, client, admin, slug, headline }) {
  step(`provider onboarding ${slug}`);
  let result = await client.from("provider_profiles").insert({
    user_id: user.id,
    status: "PROFILE_INCOMPLETE",
    onboarding_step: 1,
    public_slug: slug,
    public_headline: headline,
  });
  assert(!result.error, `Provider onboarding start failed: ${result.error?.message ?? "unknown"}`);

  result = await client
    .from("provider_profiles")
    .update({ onboarding_step: 4 })
    .eq("user_id", user.id);
  assert(!result.error, `Provider onboarding progress failed: ${result.error?.message ?? "unknown"}`);

  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const documentPath = `${user.id}/${crypto.randomUUID()}-phase10.jpg`;
  const upload = await client.storage.from("identity-documents").upload(
    documentPath,
    new Blob([bytes], { type: "image/jpeg" }),
    { contentType: "image/jpeg", upsert: false },
  );
  assert(!upload.error, `Identity upload failed: ${upload.error?.message ?? "unknown"}`);

  result = await client.from("provider_documents").insert({
    user_id: user.id,
    document_type: "DNI_FRONT",
    storage_path: documentPath,
    mime_type: "image/jpeg",
    file_size_bytes: bytes.byteLength,
  });
  assert(!result.error, `Identity metadata failed: ${result.error?.message ?? "unknown"}`);

  result = await client
    .from("provider_profiles")
    .update({ status: "IDENTITY_PENDING" })
    .eq("user_id", user.id);
  assert(!result.error, `Identity submission failed: ${result.error?.message ?? "unknown"}`);

  const decision = await admin.rpc("decide_provider_identity_review", {
    target_provider_user_id: user.id,
    requested_decision: "APPROVE",
    requested_reason: "Phase 10 beta journey verification",
  });
  assert(!decision.error && decision.data, `Identity approval failed: ${decision.error?.message ?? "unknown"}`);

  const state = await service
    .from("provider_profiles")
    .select("status,onboarding_step")
    .eq("user_id", user.id)
    .single();
  assert(
    !state.error && state.data?.status === "ACTIVE" && state.data.onboarding_step === 4,
    `Provider did not become ACTIVE after admin verification: ${JSON.stringify(state.data)}`,
  );
  return documentPath;
}

async function attachSkill(providerClient, providerUserId, skillId) {
  const result = await providerClient.from("provider_skills").insert({
    provider_user_id: providerUserId,
    skill_id: skillId,
    is_featured: true,
  });
  assert(!result.error, `Could not attach provider skill: ${result.error?.message ?? "unknown"}`);
}

async function createService(providerClient, payload) {
  const result = await providerClient.from("services").insert(payload).select("id").single();
  assert(!result.error && result.data?.id, `Could not publish service: ${result.error?.message ?? "unknown"}`);
  return result.data.id;
}

async function startConversation(client, providerSlug, serviceSlug) {
  const result = await client.rpc("start_service_conversation", {
    target_provider_slug: providerSlug,
    target_service_slug: serviceSlug,
  });
  assert(!result.error && result.data, `Could not start conversation: ${result.error?.message ?? "unknown"}`);
  return result.data;
}

async function fakePay(proposalId, clientUserId, outcome = "SUCCESS") {
  const result = await service.rpc("apply_fake_payment_result", {
    target_proposal_id: proposalId,
    payment_nonce: crypto.randomUUID(),
    payment_outcome: outcome,
    actor_client_user_id: clientUserId,
  });
  return result;
}

async function createDirectBooking(client, conversationId, scope, window) {
  const result = await client.rpc("create_conversation_proposal", {
    target_conversation_id: conversationId,
    requested_kind: "DIRECT_BOOKING",
    scope_text: scope,
    proposed_price_amount: null,
    proposed_schedule_start_at: window?.start ?? null,
    proposed_schedule_end_at: window?.end ?? null,
    proposed_deadline_at: null,
    proposal_expires_at: null,
  });
  assert(!result.error && result.data, `Direct booking failed: ${result.error?.message ?? "unknown"}`);
  return result.data;
}

async function completeJob(provider, client, jobId) {
  let result = await provider.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: "CONFIRMED",
    requested_status: "IN_PROGRESS",
    transition_reason: null,
  });
  assert(!result.error && result.data === "IN_PROGRESS", `Job start failed: ${result.error?.message ?? "unknown"}`);

  result = await provider.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: "IN_PROGRESS",
    requested_status: "COMPLETION_REQUESTED",
    transition_reason: null,
  });
  assert(
    !result.error && result.data === "COMPLETION_REQUESTED",
    `Completion request failed: ${result.error?.message ?? "unknown"}`,
  );

  result = await client.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: "COMPLETION_REQUESTED",
    requested_status: "COMPLETED",
    transition_reason: null,
  });
  assert(!result.error && result.data === "COMPLETED", `Job completion failed: ${result.error?.message ?? "unknown"}`);
}

async function createReview(client, jobId, text) {
  const result = await client.rpc("create_job_review", {
    target_job_id: jobId,
    requested_rating: 5,
    requested_review_text: text,
    requested_quality_rating: 5,
    requested_punctuality_rating: 5,
    requested_communication_rating: 5,
  });
  assert(!result.error && result.data, `Review failed: ${result.error?.message ?? "unknown"}`);
  return result.data;
}

await Promise.all(Object.values(users).map(createUser));
const [admin, client, rival, remoteProvider, localProvider, outsider] = await Promise.all([
  signIn(users.admin),
  signIn(users.client),
  signIn(users.rival),
  signIn(users.remoteProvider),
  signIn(users.localProvider),
  signIn(users.outsider),
]);

let result = await service.from("user_roles").update({ role: "admin" }).eq("user_id", users.admin.id);
assert(!result.error, `Could not promote Phase 10 admin: ${result.error?.message ?? "unknown"}`);

const remoteSlug = `phase10-remote-${compactRunId}`;
const localSlug = `phase10-local-${compactRunId}`;
const remoteServiceSlug = `ingles-${compactRunId}`;
const localServiceSlug = `electricista-${compactRunId}`;
const remoteDocumentPath = await onboardAndVerifyProvider({
  user: users.remoteProvider,
  client: remoteProvider,
  admin,
  slug: remoteSlug,
  headline: "Clases de inglés remotas Phase 10",
});
const localDocumentPath = await onboardAndVerifyProvider({
  user: users.localProvider,
  client: localProvider,
  admin,
  slug: localSlug,
  headline: "Electricista presencial Phase 10",
});

const englishSkill = await getSkill("ingles-conversacional");
const electricianSkill = await getSkill("electricista");
await attachSkill(remoteProvider, users.remoteProvider.id, englishSkill);
await attachSkill(localProvider, users.localProvider.id, electricianSkill);

// Journey A — fixed remote service -> fake payment -> completion -> review -> rehire.
step("Journey A remote fixed service");
const remoteServiceId = await createService(remoteProvider, {
  provider_user_id: users.remoteProvider.id,
  skill_id: englishSkill,
  public_slug: remoteServiceSlug,
  title: "Inglés conversacional remoto Phase 10",
  description: "Clase remota individual de inglés conversacional para validar el journey integral de beta.",
  modality: "REMOTE",
  price_model: "FIXED",
  price_amount: 85000,
  currency_code: "ARS",
  accepts_offers: true,
  schedule_type: "FIXED_SLOT",
  expected_duration_minutes: 60,
  is_published: true,
  is_paused: false,
});

let discovery = await anonymous.rpc("search_discovery_services_v3", {
  query_text: "ingles",
  modality_filter: "REMOTE",
  page_number: 1,
  page_size: 24,
});
assert(
  !discovery.error && discovery.data?.some((row) => row.service_slug === remoteServiceSlug),
  `Journey A service was not discoverable: ${discovery.error?.message ?? "missing result"}`,
);

const remoteConversationId = await startConversation(client, remoteSlug, remoteServiceSlug);
const remoteWindow = fixedWindow(3, 14);
const remoteProposalId = await createDirectBooking(
  client,
  remoteConversationId,
  "Clase conversacional enfocada en entrevistas laborales.",
  remoteWindow,
);
const remotePaid = await fakePay(remoteProposalId, users.client.id);
const remotePayment = remotePaid.data?.[0];
assert(
  !remotePaid.error &&
    remotePayment?.resulting_proposal_status === "PAID" &&
    remotePayment.confirmed_job_id,
  `Journey A fake payment failed: ${remotePaid.error?.message ?? "unknown"}`,
);
const remoteJobId = remotePayment.confirmed_job_id;
await completeJob(remoteProvider, client, remoteJobId);
await createReview(client, remoteJobId, "Excelente clase remota. Journey A verificado.");

const rehire = await client.rpc("create_rehire_proposal", { target_job_id: remoteJobId });
assert(
  !rehire.error &&
    rehire.data?.[0]?.proposal_id &&
    rehire.data[0].proposal_id !== remoteProposalId &&
    rehire.data[0].proposal_status === "AWAITING_PAYMENT",
  `Journey A rehire failed: ${rehire.error?.message ?? JSON.stringify(rehire.data)}`,
);
step("Journey A PASS");

// Journey B — in-person quote/counteroffer, attachment, radius, location, reschedule and additional payment.
step("Journey B in-person quote");
const localServiceId = await createService(localProvider, {
  provider_user_id: users.localProvider.id,
  skill_id: electricianSkill,
  public_slug: localServiceSlug,
  title: "Electricista a domicilio Phase 10",
  description: "Diagnóstico e intervención eléctrica presencial con cotización, agenda y alcance acordado.",
  modality: "IN_PERSON",
  price_model: "QUOTE",
  price_amount: null,
  currency_code: "ARS",
  accepts_offers: true,
  schedule_type: "FIXED_SLOT",
  expected_duration_minutes: 60,
  is_published: true,
  is_paused: false,
});

result = await localProvider.from("service_areas").insert({
  provider_user_id: users.localProvider.id,
  label: "CABA Phase 10",
  center: "SRID=4326;POINT(-58.43 -34.58)",
  radius_meters: 8000,
  is_active: true,
});
assert(!result.error, `Could not create Journey B service area: ${result.error?.message ?? "unknown"}`);

discovery = await anonymous.rpc("search_discovery_services_v3", {
  query_text: "electricista",
  modality_filter: "IN_PERSON",
  origin_lat: -34.58,
  origin_lng: -58.43,
  radius_meters: 5000,
  page_number: 1,
  page_size: 24,
});
assert(
  !discovery.error && discovery.data?.some((row) => row.service_slug === localServiceSlug),
  `Journey B radius discovery failed: ${discovery.error?.message ?? "missing result"}`,
);

const localConversationId = await startConversation(client, localSlug, localServiceSlug);
const attachmentMessage = await client.rpc("create_conversation_attachment_message", {
  target_conversation_id: localConversationId,
  attachment_kind: "IMAGE",
  message_nonce: crypto.randomUUID(),
});
assert(!attachmentMessage.error && attachmentMessage.data, `Attachment message failed: ${attachmentMessage.error?.message ?? "unknown"}`);
const photoBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const photoPath = `${localConversationId}/${attachmentMessage.data}/${crypto.randomUUID()}/tablero.jpg`;
const photoUpload = await client.storage.from("conversation-attachments").upload(
  photoPath,
  new Blob([photoBytes], { type: "image/jpeg" }),
  { contentType: "image/jpeg", upsert: false },
);
assert(!photoUpload.error, `Journey B photo upload failed: ${photoUpload.error?.message ?? "unknown"}`);
const registeredPhoto = await client.rpc("register_conversation_attachment", {
  target_message_id: attachmentMessage.data,
  object_path: photoPath,
  attachment_mime_type: "image/jpeg",
  attachment_size_bytes: photoBytes.byteLength,
  attachment_original_name: "tablero.jpg",
});
assert(!registeredPhoto.error && registeredPhoto.data, `Journey B photo registration failed: ${registeredPhoto.error?.message ?? "unknown"}`);

const outsiderAttachment = await outsider.storage.from("conversation-attachments").download(photoPath);
assert(Boolean(outsiderAttachment.error), "Journey C: outsider can read Journey B private attachment.");

const quoteWindow = fixedWindow(5, 13);
const providerQuote = await localProvider.rpc("create_conversation_proposal", {
  target_conversation_id: localConversationId,
  requested_kind: "PROVIDER_QUOTE",
  scope_text: "Revisión del tablero y reparación del circuito afectado.",
  proposed_price_amount: 180000,
  proposed_schedule_start_at: quoteWindow.start,
  proposed_schedule_end_at: quoteWindow.end,
  proposed_deadline_at: null,
  proposal_expires_at: null,
});
assert(!providerQuote.error && providerQuote.data, `Provider quote failed: ${providerQuote.error?.message ?? "unknown"}`);

const counteroffer = await client.rpc("revise_conversation_proposal", {
  target_proposal_id: providerQuote.data,
  requested_kind: "COUNTEROFFER",
  scope_text: "Revisión del tablero y reparación del circuito afectado.",
  proposed_price_amount: 165000,
  proposed_schedule_start_at: quoteWindow.start,
  proposed_schedule_end_at: quoteWindow.end,
  proposed_deadline_at: null,
  proposal_expires_at: null,
});
assert(!counteroffer.error && counteroffer.data, `Client counteroffer failed: ${counteroffer.error?.message ?? "unknown"}`);

const acceptedCounter = await localProvider.rpc("respond_to_proposal", {
  target_proposal_id: providerQuote.data,
  response_action: "ACCEPT",
});
assert(
  !acceptedCounter.error && acceptedCounter.data === "AWAITING_PAYMENT",
  `Provider could not accept counteroffer: ${acceptedCounter.error?.message ?? acceptedCounter.data ?? "unknown"}`,
);

const localPaid = await fakePay(providerQuote.data, users.client.id);
const localPayment = localPaid.data?.[0];
assert(
  !localPaid.error && localPayment?.resulting_proposal_status === "PAID" && localPayment.confirmed_job_id,
  `Journey B fake payment failed: ${localPaid.error?.message ?? "unknown"}`,
);
const localJobId = localPayment.confirmed_job_id;

const exactLocation = await client.rpc("set_job_exact_location", {
  target_job_id: localJobId,
  exact_address_text: "Av. Corrientes 1234, CABA",
  lat: -34.6037,
  lng: -58.3816,
  notes: "Timbre Phase 10",
});
assert(!exactLocation.error, `Could not set Journey B location: ${exactLocation.error?.message ?? "unknown"}`);
const providerJobDetail = await localProvider.rpc("get_job_detail", { target_job_id: localJobId });
assert(
  !providerJobDetail.error && providerJobDetail.data?.[0]?.exact_address === "Av. Corrientes 1234, CABA",
  "Journey B exact location was not released to the confirmed provider.",
);

const rescheduledWindow = fixedWindow(6, 15);
const reschedule = await client.rpc("request_job_reschedule", {
  target_job_id: localJobId,
  requested_schedule_type: "FIXED_SLOT",
  requested_starts_at: rescheduledWindow.start,
  requested_ends_at: rescheduledWindow.end,
  requested_deadline_at: null,
  requested_duration_minutes: 60,
  request_reason: "Cambio coordinado en Phase 10",
});
assert(!reschedule.error && reschedule.data, `Journey B reschedule failed: ${reschedule.error?.message ?? "unknown"}`);
const rescheduleAccepted = await localProvider.rpc("respond_job_reschedule", {
  target_request_id: reschedule.data,
  response_action: "ACCEPT",
});
assert(
  !rescheduleAccepted.error && rescheduleAccepted.data === "ACCEPTED",
  `Journey B reschedule acceptance failed: ${rescheduleAccepted.error?.message ?? "unknown"}`,
);

result = await localProvider.rpc("transition_job_status", {
  target_job_id: localJobId,
  expected_status: "CONFIRMED",
  requested_status: "IN_PROGRESS",
  transition_reason: null,
});
assert(!result.error && result.data === "IN_PROGRESS", `Journey B job start failed: ${result.error?.message ?? "unknown"}`);

const scopeChange = await localProvider.rpc("request_job_scope_change", {
  target_job_id: localJobId,
  new_scope_text: "Reparación del circuito más reemplazo preventivo de una térmica dañada.",
  additional_amount_minor: 45000,
});
assert(!scopeChange.error && scopeChange.data, `Journey B scope increase failed: ${scopeChange.error?.message ?? "unknown"}`);
const scopeAccepted = await client.rpc("respond_job_scope_change", {
  target_scope_change_id: scopeChange.data,
  response_action: "ACCEPT",
});
assert(
  !scopeAccepted.error && scopeAccepted.data === "AWAITING_PAYMENT",
  `Journey B scope acceptance failed: ${scopeAccepted.error?.message ?? "unknown"}`,
);
const additionalPaid = await service.rpc("apply_fake_additional_payment_result", {
  target_scope_change_id: scopeChange.data,
  payment_nonce: crypto.randomUUID(),
  payment_outcome: "SUCCESS",
  actor_client_user_id: users.client.id,
});
assert(
  !additionalPaid.error && additionalPaid.data?.[0]?.resulting_scope_change_status === "PAID",
  `Journey B additional fake payment failed: ${additionalPaid.error?.message ?? "unknown"}`,
);

result = await localProvider.rpc("transition_job_status", {
  target_job_id: localJobId,
  expected_status: "IN_PROGRESS",
  requested_status: "COMPLETION_REQUESTED",
  transition_reason: null,
});
assert(!result.error && result.data === "COMPLETION_REQUESTED", `Journey B completion request failed: ${result.error?.message ?? "unknown"}`);
result = await client.rpc("transition_job_status", {
  target_job_id: localJobId,
  expected_status: "COMPLETION_REQUESTED",
  requested_status: "COMPLETED",
  transition_reason: null,
});
assert(!result.error && result.data === "COMPLETED", `Journey B completion failed: ${result.error?.message ?? "unknown"}`);
await createReview(client, localJobId, "Trabajo presencial resuelto. Journey B verificado.");
step("Journey B PASS");

// Journey C — required negative paths and concurrency/idempotency boundaries.
step("Journey C failure matrix");
const unauthorizedJob = await outsider.rpc("get_job_detail", { target_job_id: localJobId });
assert(Boolean(unauthorizedJob.error), "Journey C: outsider can inspect another user's Job.");
const unauthorizedConversation = await outsider.rpc("list_conversation_messages", {
  target_conversation_id: localConversationId,
  page_size: 20,
  before_created_at: null,
  before_id: null,
});
assert(Boolean(unauthorizedConversation.error), "Journey C: outsider can inspect private messages.");

const failureConversation = await startConversation(rival, remoteSlug, remoteServiceSlug);
const failureWindow = fixedWindow(9, 12);
const failureProposal = await createDirectBooking(
  rival,
  failureConversation,
  "Reserva destinada a validar fallo de pago fake.",
  failureWindow,
);
const failedPayment = await fakePay(failureProposal, users.rival.id, "FAILURE");
assert(
  !failedPayment.error &&
    failedPayment.data?.[0]?.resulting_proposal_status === "PAYMENT_FAILED" &&
    failedPayment.data[0].confirmed_job_id === null,
  `Journey C fake payment failure contract broke: ${failedPayment.error?.message ?? JSON.stringify(failedPayment.data)}`,
);

const raceOffer = await client.rpc("create_conversation_proposal", {
  target_conversation_id: localConversationId,
  requested_kind: "CLIENT_OFFER",
  scope_text: "Oferta de carrera de aceptación Phase 10",
  proposed_price_amount: 150000,
  proposed_schedule_start_at: fixedWindow(10, 11).start,
  proposed_schedule_end_at: fixedWindow(10, 11).end,
  proposed_deadline_at: null,
  proposal_expires_at: null,
});
assert(!raceOffer.error && raceOffer.data, `Could not create proposal race fixture: ${raceOffer.error?.message ?? "unknown"}`);
const [raceA, raceB] = await Promise.all([
  localProvider.rpc("respond_to_proposal", { target_proposal_id: raceOffer.data, response_action: "ACCEPT" }),
  localProvider.rpc("respond_to_proposal", { target_proposal_id: raceOffer.data, response_action: "ACCEPT" }),
]);
assert(
  !raceA.error && !raceB.error && raceA.data === "AWAITING_PAYMENT" && raceB.data === "AWAITING_PAYMENT",
  "Journey C proposal acceptance is not idempotent under concurrency.",
);
const raceEvents = await service
  .from("proposal_events")
  .select("id")
  .eq("proposal_id", raceOffer.data)
  .eq("event_type", "PROPOSAL_ACCEPTED");
assert(!raceEvents.error && raceEvents.data?.length === 1, "Journey C proposal race emitted duplicate acceptance events.");

const firstConflictConversation = await startConversation(client, remoteSlug, remoteServiceSlug);
const secondConflictConversation = await startConversation(rival, remoteSlug, remoteServiceSlug);
const conflictWindow = fixedWindow(12, 16);
const firstConflictProposal = await createDirectBooking(
  client,
  firstConflictConversation,
  "Primera reserva del slot en conflicto.",
  conflictWindow,
);
const secondConflictProposal = await createDirectBooking(
  rival,
  secondConflictConversation,
  "Segunda reserva incompatible del mismo slot.",
  conflictWindow,
);
const firstConflictPaid = await fakePay(firstConflictProposal, users.client.id);
assert(!firstConflictPaid.error && firstConflictPaid.data?.[0]?.confirmed_job_id, "Journey C first conflict booking did not confirm.");
const secondConflictPaid = await fakePay(secondConflictProposal, users.rival.id);
assert(Boolean(secondConflictPaid.error), "Journey C double-booking attempt created a second confirmed Job.");

const cancelWindow = fixedWindow(14, 10);
const cancelProposal = await createDirectBooking(client, firstConflictConversation, "Trabajo cancelable Phase 10", cancelWindow);
const cancelPaid = await fakePay(cancelProposal, users.client.id);
const cancelJobId = cancelPaid.data?.[0]?.confirmed_job_id;
assert(!cancelPaid.error && cancelJobId, "Could not create cancellation fixture.");
const cancelled = await client.rpc("transition_job_status", {
  target_job_id: cancelJobId,
  expected_status: "CONFIRMED",
  requested_status: "CANCELLED",
  transition_reason: "Cancelación requerida por Journey C",
});
assert(!cancelled.error && cancelled.data === "CANCELLED", "Journey C cancellation transition failed.");

const noShowWindow = fixedWindow(15, 10);
const noShowProposal = await createDirectBooking(client, firstConflictConversation, "Trabajo no-show Phase 10", noShowWindow);
const noShowPaid = await fakePay(noShowProposal, users.client.id);
const noShowJobId = noShowPaid.data?.[0]?.confirmed_job_id;
assert(!noShowPaid.error && noShowJobId, "Could not create no-show fixture.");
const noShow = await remoteProvider.rpc("transition_job_status", {
  target_job_id: noShowJobId,
  expected_status: "CONFIRMED",
  requested_status: "NO_SHOW",
  transition_reason: "No-show requerido por Journey C",
});
assert(!noShow.error && noShow.data === "NO_SHOW", "Journey C no-show transition failed.");

const invalidReview = await client.rpc("create_job_review", {
  target_job_id: remoteJobId,
  requested_rating: 6,
  requested_review_text: "Rating inválido Phase 10",
  requested_quality_rating: null,
  requested_punctuality_rating: null,
  requested_communication_rating: null,
});
assert(Boolean(invalidReview.error), "Journey C accepted an invalid review rating.");

const expiringOffer = await client.rpc("create_conversation_proposal", {
  target_conversation_id: localConversationId,
  requested_kind: "CLIENT_OFFER",
  scope_text: "Oferta destinada a expirar en Journey C",
  proposed_price_amount: 140000,
  proposed_schedule_start_at: null,
  proposed_schedule_end_at: null,
  proposed_deadline_at: null,
  proposal_expires_at: new Date(Date.now() + 60_000).toISOString(),
});
assert(!expiringOffer.error && expiringOffer.data, `Could not create expiring proposal: ${expiringOffer.error?.message ?? "unknown"}`);
result = await service
  .from("proposals")
  .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
  .eq("id", expiringOffer.data);
assert(!result.error, `Could not force proposal expiry: ${result.error?.message ?? "unknown"}`);
const expiredRevision = await client.rpc("revise_conversation_proposal", {
  target_proposal_id: expiringOffer.data,
  requested_kind: "CLIENT_OFFER",
  scope_text: "No debe reabrirse",
  proposed_price_amount: 141000,
  proposed_schedule_start_at: null,
  proposed_schedule_end_at: null,
  proposed_deadline_at: null,
  proposal_expires_at: null,
});
assert(!expiredRevision.error && expiredRevision.data === null, "Journey C expired proposal was reopened.");
const expiredRow = await service.from("proposals").select("status").eq("id", expiringOffer.data).single();
assert(!expiredRow.error && expiredRow.data?.status === "EXPIRED", "Journey C expiry was not persisted.");

const suspended = await admin.rpc("admin_set_account_restriction", {
  target_user_id: users.localProvider.id,
  requested_kind: "SUSPENDED",
  requested_reason: "Phase 10 suspension failure matrix",
});
assert(!suspended.error && suspended.data, `Journey C suspension failed: ${suspended.error?.message ?? "unknown"}`);
const suspendedWrite = await localProvider
  .from("services")
  .update({ title: "Cambio no autorizado durante suspensión" })
  .eq("id", localServiceId);
assert(Boolean(suspendedWrite.error), "Journey C suspended provider can mutate marketplace data.");
const restored = await admin.rpc("admin_restore_account", {
  target_user_id: users.localProvider.id,
  requested_reason: "Phase 10 suspension fixture restored",
});
assert(!restored.error, `Journey C restore failed: ${restored.error?.message ?? "unknown"}`);
step("Journey C PASS");

// Final runtime invariants: fake money only and no exact-address retention after completion.
const remoteAttempts = await service.from("payment_attempts").select("provider_name").eq("proposal_id", remoteProposalId);
assert(
  !remoteAttempts.error && remoteAttempts.data?.every((attempt) => attempt.provider_name === "FAKE"),
  "Phase 10 runtime crossed the fake-payment boundary.",
);
const localAfterCompletion = await localProvider.rpc("get_job_detail", { target_job_id: localJobId });
assert(
  !localAfterCompletion.error && localAfterCompletion.data?.[0]?.exact_address === null,
  "Exact address remained visible to provider after Journey B completion.",
);

// Keep local DB disposable, but explicitly remove uploaded objects so repeated manual runs do not accumulate blobs.
await service.storage.from("conversation-attachments").remove([photoPath]);
await service.storage.from("identity-documents").remove([remoteDocumentPath, localDocumentPath]);

assert(remoteServiceId && localServiceId, "Phase 10 service fixtures disappeared unexpectedly.");
console.log("Phase 10 beta runtime Journeys A + B + C: PASS");

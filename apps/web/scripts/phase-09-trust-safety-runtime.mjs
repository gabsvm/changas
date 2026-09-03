import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase credentials are required for Phase 09 trust and safety runtime checks.",
  );
}

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const runId = crypto.randomUUID();
const password = `Phase09-trust-${runId}-ValidPassword!`;
const users = {
  admin: { email: `phase09-trust-admin-${runId}@example.test` },
  client: { email: `phase09-trust-client-${runId}@example.test` },
  provider: { email: `phase09-trust-provider-${runId}@example.test` },
  outsider: { email: `phase09-trust-outsider-${runId}@example.test` },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createUser(user) {
  const { data, error } = await service.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { display_name: user.email.split("@")[0] },
  });
  assert(
    !error && data.user,
    `Could not create trust runtime user: ${error?.message ?? "unknown"}`,
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
    `Could not sign in trust runtime user: ${error?.message ?? "unknown"}`,
  );
  return client;
}

await Promise.all(Object.values(users).map(createUser));
await service
  .from("user_roles")
  .update({ role: "admin" })
  .eq("user_id", users.admin.id);

const categoryId = crypto.randomUUID();
const skillId = crypto.randomUUID();
const serviceId = crypto.randomUUID();
const conversationId = crypto.randomUUID();
const messageId = crypto.randomUUID();
const proposalId = crypto.randomUUID();
const proposalVersionId = crypto.randomUUID();
const paymentAttemptId = crypto.randomUUID();
const jobId = crypto.randomUUID();
const reviewId = crypto.randomUUID();
const conversationReportId = crypto.randomUUID();
const reviewReportId = crypto.randomUUID();
const providerSlug = `phase09-trust-provider-${runId}`.toLowerCase();

let result = await service.from("provider_profiles").insert({
  user_id: users.provider.id,
  status: "ACTIVE",
  onboarding_step: 4,
  public_slug: providerSlug,
});
assert(
  !result.error,
  `Could not create trust runtime provider: ${result.error?.message ?? "unknown"}`,
);

result = await service.from("categories").insert({
  id: categoryId,
  slug: `phase09-trust-${runId}`.toLowerCase(),
  name: `Phase09 Trust ${runId}`,
  description: "Synthetic trust and safety runtime category.",
  sort_order: 998,
});
assert(
  !result.error,
  `Could not create trust category: ${result.error?.message ?? "unknown"}`,
);

result = await service.from("skills").insert({
  id: skillId,
  category_id: categoryId,
  slug: `phase09-trust-skill-${runId}`.toLowerCase(),
  name: `Phase09 Trust Skill ${runId}`,
  description: "Synthetic trust and safety runtime skill.",
  sort_order: 998,
});
assert(
  !result.error,
  `Could not create trust skill: ${result.error?.message ?? "unknown"}`,
);

await service
  .from("provider_skills")
  .insert({ provider_user_id: users.provider.id, skill_id: skillId });
result = await service.from("services").insert({
  id: serviceId,
  provider_user_id: users.provider.id,
  skill_id: skillId,
  public_slug: `phase09-trust-service-${runId}`.toLowerCase(),
  title: "Servicio trust safety",
  description:
    "Servicio sintético suficientemente descriptivo para validar moderación y restauración.",
  modality: "REMOTE",
  price_model: "FIXED",
  price_amount: 100000,
  currency_code: "ARS",
  schedule_type: "UNSCHEDULED",
  is_published: true,
});
assert(
  !result.error,
  `Could not create trust service: ${result.error?.message ?? "unknown"}`,
);

await service.from("conversations").insert({
  id: conversationId,
  service_id: serviceId,
  client_user_id: users.client.id,
  provider_user_id: users.provider.id,
});
await service.from("conversation_participants").insert([
  { conversation_id: conversationId, user_id: users.client.id, role: "CLIENT" },
  {
    conversation_id: conversationId,
    user_id: users.provider.id,
    role: "PROVIDER",
  },
]);
await service.from("messages").insert({
  id: messageId,
  conversation_id: conversationId,
  sender_user_id: users.client.id,
  kind: "TEXT",
  body: "Mensaje de evidencia que debe preservarse.",
  client_nonce: crypto.randomUUID(),
});
await service.from("conversation_reports").insert({
  id: conversationReportId,
  conversation_id: conversationId,
  reporter_user_id: users.client.id,
  category: "ABUSE",
  reason: "Reporte sintético para cola administrativa.",
});

await service.from("proposals").insert({
  id: proposalId,
  conversation_id: conversationId,
  service_id: serviceId,
  client_user_id: users.client.id,
  provider_user_id: users.provider.id,
  kind: "DIRECT_BOOKING",
  status: "PAID",
  created_by_user_id: users.client.id,
});
await service.from("proposal_versions").insert({
  id: proposalVersionId,
  proposal_id: proposalId,
  version_number: 1,
  kind: "DIRECT_BOOKING",
  authored_by_user_id: users.client.id,
  service_title_snapshot: "Servicio trust safety",
  service_description_snapshot:
    "Servicio sintético suficientemente descriptivo para validar moderación y restauración.",
  modality: "REMOTE",
  scope_snapshot: "Trabajo sintético",
  price_model_snapshot: "FIXED",
  price_amount: 100000,
  currency_code: "ARS",
  schedule_type: "UNSCHEDULED",
});
await service
  .from("proposals")
  .update({
    current_version_id: proposalVersionId,
    accepted_version_id: proposalVersionId,
  })
  .eq("id", proposalId);
await service.from("payment_attempts").insert({
  id: paymentAttemptId,
  proposal_id: proposalId,
  accepted_proposal_version_id: proposalVersionId,
  request_nonce: crypto.randomUUID(),
  provider_name: "FAKE",
  provider_reference: `phase09-${runId}`,
  status: "SUCCEEDED",
  amount_minor: 100000,
  currency_code: "ARS",
});
result = await service.from("jobs").insert({
  id: jobId,
  conversation_id: conversationId,
  service_id: serviceId,
  client_user_id: users.client.id,
  provider_user_id: users.provider.id,
  accepted_proposal_version_id: proposalVersionId,
  payment_attempt_id: paymentAttemptId,
  status: "COMPLETED",
});
assert(
  !result.error,
  `Could not create trust job: ${result.error?.message ?? "unknown"}`,
);

result = await service.from("reviews").insert({
  id: reviewId,
  job_id: jobId,
  service_id: serviceId,
  skill_id: skillId,
  category_id: categoryId,
  reviewer_user_id: users.client.id,
  provider_user_id: users.provider.id,
  rating: 1,
  review_text: "Reseña negativa sintética preservada para validar moderación.",
  service_title_snapshot: "Servicio trust safety",
  skill_name_snapshot: `Phase09 Trust Skill ${runId}`,
  category_name_snapshot: `Phase09 Trust ${runId}`,
});
assert(
  !result.error,
  `Could not create trust review: ${result.error?.message ?? "unknown"}`,
);
await service.from("review_reports").insert({
  id: reviewReportId,
  review_id: reviewId,
  reporter_user_id: users.provider.id,
  reason: "ABUSE",
  details: "Reporte sintético de reseña.",
});

const [admin, client, provider, outsider] = await Promise.all([
  signIn(users.admin),
  signIn(users.client),
  signIn(users.provider),
  signIn(users.outsider),
]);
const anonymous = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const deniedQueue = await client.rpc("list_admin_reports", {
  requested_status: null,
  page_size: 50,
  page_offset: 0,
});
assert(
  Boolean(deniedQueue.error),
  "Normal user can inspect the admin report queue.",
);
const outsiderQueue = await outsider.rpc("list_admin_reports", {
  requested_status: null,
  page_size: 50,
  page_offset: 0,
});
assert(
  Boolean(outsiderQueue.error),
  "Outsider can inspect the admin report queue.",
);
const queue = await admin.rpc("list_admin_reports", {
  requested_status: "OPEN",
  page_size: 50,
  page_offset: 0,
});
assert(
  !queue.error &&
    queue.data?.some((row) => row.report_id === conversationReportId) &&
    queue.data?.some((row) => row.report_id === reviewReportId),
  `Admin report queue failed: ${queue.error?.message ?? "unknown"}`,
);

const providerHide = await provider.rpc("admin_set_review_moderation", {
  target_review_id: reviewId,
  requested_disposition: "HIDDEN_POLICY",
  requested_reason: "Intento no autorizado",
});
assert(Boolean(providerHide.error), "Provider can hide a negative review.");

let publicReviews = await anonymous.rpc("list_public_provider_reviews", {
  target_provider_slug: providerSlug,
  skill_filter: null,
  service_filter: null,
  before_created_at: null,
  before_id: null,
  page_size: 20,
});
assert(
  !publicReviews.error &&
    publicReviews.data?.some((row) => row.review_id === reviewId),
  "Visible review is missing before moderation.",
);

let moderation = await admin.rpc("admin_set_review_moderation", {
  target_review_id: reviewId,
  requested_disposition: "HIDDEN_POLICY",
  requested_reason: "Contenido oculto por política durante la prueba.",
});
assert(
  !moderation.error,
  `Admin could not hide review: ${moderation.error?.message ?? "unknown"}`,
);
publicReviews = await anonymous.rpc("list_public_provider_reviews", {
  target_provider_slug: providerSlug,
  skill_filter: null,
  service_filter: null,
  before_created_at: null,
  before_id: null,
  page_size: 20,
});
assert(
  !publicReviews.error &&
    !publicReviews.data?.some((row) => row.review_id === reviewId),
  "Policy-hidden review remains public.",
);
let reputation = await anonymous.rpc("get_public_provider_reputation", {
  target_provider_slug: providerSlug,
});
assert(
  !reputation.error && reputation.data?.[0]?.review_count === 0,
  "Policy-hidden review still affects public reputation.",
);

moderation = await admin.rpc("admin_set_review_moderation", {
  target_review_id: reviewId,
  requested_disposition: "RESTORED",
  requested_reason: "Restaurada tras revisión administrativa.",
});
assert(
  !moderation.error,
  `Admin could not restore review: ${moderation.error?.message ?? "unknown"}`,
);
publicReviews = await anonymous.rpc("list_public_provider_reviews", {
  target_provider_slug: providerSlug,
  skill_filter: null,
  service_filter: null,
  before_created_at: null,
  before_id: null,
  page_size: 20,
});
assert(
  !publicReviews.error &&
    publicReviews.data?.some((row) => row.review_id === reviewId),
  "Restored review did not return to public reads.",
);
reputation = await anonymous.rpc("get_public_provider_reputation", {
  target_provider_slug: providerSlug,
});
assert(
  !reputation.error && reputation.data?.[0]?.review_count === 1,
  "Restored review did not return to public reputation.",
);

let participantMessage = await client
  .from("messages")
  .select("id")
  .eq("id", messageId);
assert(
  !participantMessage.error && participantMessage.data?.length === 1,
  "Participant cannot see preserved message before moderation.",
);
moderation = await admin.rpc("admin_set_message_moderation", {
  target_message_id: messageId,
  requested_disposition: "HIDDEN_POLICY",
  requested_reason: "Evidencia oculta de la conversación.",
});
assert(
  !moderation.error,
  `Admin could not hide message: ${moderation.error?.message ?? "unknown"}`,
);
participantMessage = await client
  .from("messages")
  .select("id")
  .eq("id", messageId);
assert(
  !participantMessage.error && participantMessage.data?.length === 0,
  "Hidden message remains visible to participant.",
);
const preservedMessage = await service
  .from("messages")
  .select("id,body")
  .eq("id", messageId)
  .single();
assert(
  !preservedMessage.error && preservedMessage.data?.body?.includes("evidencia"),
  "Message evidence was destructively removed.",
);
await admin.rpc("admin_set_message_moderation", {
  target_message_id: messageId,
  requested_disposition: "RESTORED",
  requested_reason: "Mensaje restaurado.",
});
participantMessage = await client
  .from("messages")
  .select("id")
  .eq("id", messageId);
assert(
  !participantMessage.error && participantMessage.data?.length === 1,
  "Restored message did not return to participant reads.",
);

let restriction = await admin.rpc("admin_set_account_restriction", {
  target_user_id: users.provider.id,
  requested_kind: "SUSPENDED",
  requested_reason: "Suspensión sintética de seguridad.",
});
assert(
  !restriction.error && restriction.data,
  `Admin could not suspend provider: ${restriction.error?.message ?? "unknown"}`,
);
let providerState = await service
  .from("provider_profiles")
  .select("status,marketplace_paused,availability_paused")
  .eq("user_id", users.provider.id)
  .single();
assert(
  !providerState.error &&
    providerState.data?.status === "SUSPENDED" &&
    providerState.data.marketplace_paused &&
    providerState.data.availability_paused,
  "Provider suspension was not synchronized.",
);
const selfRestore = await provider.rpc("admin_restore_account", {
  target_user_id: users.provider.id,
  requested_reason: "No autorizado",
});
assert(
  Boolean(selfRestore.error),
  "Suspended provider can restore their own account.",
);
const blockedWrite = await provider
  .from("services")
  .update({ title: "No debería cambiar" })
  .eq("id", serviceId);
assert(
  Boolean(blockedWrite.error),
  "Suspended account can still mutate transactional marketplace data.",
);
restriction = await admin.rpc("admin_restore_account", {
  target_user_id: users.provider.id,
  requested_reason: "Restauración sintética tras revisión.",
});
assert(
  !restriction.error,
  `Admin could not restore provider: ${restriction.error?.message ?? "unknown"}`,
);
providerState = await service
  .from("provider_profiles")
  .select("status,marketplace_paused,availability_paused")
  .eq("user_id", users.provider.id)
  .single();
assert(
  !providerState.error &&
    providerState.data?.status === "ACTIVE" &&
    !providerState.data.marketplace_paused &&
    !providerState.data.availability_paused,
  "Provider restore did not recover the last safe state.",
);

for (const [reportType, reportId] of [
  ["CONVERSATION_REPORT", conversationReportId],
  ["REVIEW_REPORT", reviewReportId],
]) {
  const resolution = await admin.rpc("admin_resolve_report", {
    requested_report_type: reportType,
    target_report_id: reportId,
    requested_resolution: "Caso revisado y cerrado en runtime Phase 09.",
  });
  assert(
    !resolution.error && resolution.data,
    `Could not resolve ${reportType}: ${resolution.error?.message ?? "unknown"}`,
  );
}

const closedQueue = await admin.rpc("list_admin_reports", {
  requested_status: "RESOLVED",
  page_size: 50,
  page_offset: 0,
});
assert(
  !closedQueue.error &&
    closedQueue.data?.some((row) => row.report_id === conversationReportId) &&
    closedQueue.data?.some((row) => row.report_id === reviewReportId),
  "Resolved reports are missing from preserved case history.",
);

const audits = await admin.rpc("list_admin_audit_events", {
  before_created_at: null,
  page_size: 100,
});
const expectedActions = [
  "REVIEW_HIDDEN_POLICY",
  "REVIEW_RESTORED",
  "MESSAGE_HIDDEN_POLICY",
  "MESSAGE_RESTORED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_RESTORED",
  "REPORT_RESOLVED",
];
assert(
  !audits.error &&
    expectedActions.every((action) =>
      audits.data?.some((row) => row.action_type === action),
    ),
  `Trust and safety audit trail is incomplete: ${audits.error?.message ?? "unknown"}`,
);

console.log("Phase 09 trust and safety runtime checks: PASS");

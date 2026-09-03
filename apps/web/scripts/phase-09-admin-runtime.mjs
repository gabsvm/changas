import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase credentials are required for Phase 09 admin runtime checks.",
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
const password = `Phase09-admin-${runId}-valid-password`;
const users = {
  admin: { email: `phase09-admin-${runId}@example.test` },
  member: { email: `phase09-member-${runId}@example.test` },
  outsider: { email: `phase09-outsider-${runId}@example.test` },
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

await Promise.all(Object.values(users).map(createUser));

const promoted = await service
  .from("user_roles")
  .update({ role: "admin" })
  .eq("user_id", users.admin.id);
assert(
  !promoted.error,
  `Could not promote synthetic admin: ${promoted.error?.message ?? "unknown"}`,
);

const provider = await service.from("provider_profiles").insert({
  user_id: users.member.id,
  status: "PROFILE_INCOMPLETE",
  onboarding_step: 1,
});
assert(
  !provider.error,
  `Could not create synthetic provider: ${provider.error?.message ?? "unknown"}`,
);

const [admin, member, outsider] = await Promise.all([
  signIn(users.admin),
  signIn(users.member),
  signIn(users.outsider),
]);

const adminRole = await admin.rpc("is_current_user_admin");
assert(
  !adminRole.error && adminRole.data === true,
  `Promoted admin was not recognized: ${adminRole.error?.message ?? "unknown"}`,
);

const memberRole = await member.rpc("is_current_user_admin");
assert(
  !memberRole.error && memberRole.data === false,
  `Normal member was recognized as admin: ${memberRole.error?.message ?? "unknown"}`,
);

const memberUsers = await member.rpc("list_admin_users", {
  search_text: null,
  page_size: 50,
  page_offset: 0,
});
assert(Boolean(memberUsers.error), "Normal member can list admin users.");

const outsiderUsers = await outsider.rpc("list_admin_users", {
  search_text: null,
  page_size: 50,
  page_offset: 0,
});
assert(Boolean(outsiderUsers.error), "Outsider can list admin users.");

const adminUsers = await admin.rpc("list_admin_users", {
  search_text: "phase09-",
  page_size: 50,
  page_offset: 0,
});
assert(
  !adminUsers.error &&
    Array.isArray(adminUsers.data) &&
    adminUsers.data.some((row) => row.user_id === users.member.id) &&
    adminUsers.data.some((row) => row.user_id === users.admin.id),
  `Admin user listing failed: ${adminUsers.error?.message ?? "unknown"}`,
);

const adminUserDetail = await admin.rpc("get_admin_user_detail", {
  target_user_id: users.member.id,
});
assert(
  !adminUserDetail.error &&
    adminUserDetail.data?.[0]?.user_id === users.member.id &&
    adminUserDetail.data?.[0]?.provider_status === "PROFILE_INCOMPLETE",
  `Admin user detail failed: ${adminUserDetail.error?.message ?? "unknown"}`,
);

const adminProviders = await admin.rpc("list_admin_providers", {
  search_text: null,
  requested_status: "PROFILE_INCOMPLETE",
  page_size: 50,
  page_offset: 0,
});
assert(
  !adminProviders.error &&
    adminProviders.data?.some(
      (row) => row.provider_user_id === users.member.id,
    ),
  `Admin provider listing failed: ${adminProviders.error?.message ?? "unknown"}`,
);

const memberProviders = await member.rpc("list_admin_providers", {
  search_text: null,
  requested_status: null,
  page_size: 50,
  page_offset: 0,
});
assert(
  Boolean(memberProviders.error),
  "Normal member can list admin providers.",
);

const adminProviderDetail = await admin.rpc("get_admin_provider_detail", {
  target_provider_user_id: users.member.id,
});
assert(
  !adminProviderDetail.error &&
    adminProviderDetail.data?.[0]?.provider_user_id === users.member.id,
  `Admin provider detail failed: ${adminProviderDetail.error?.message ?? "unknown"}`,
);

const adminJobs = await admin.rpc("list_admin_jobs", {
  requested_status: null,
  search_text: null,
  page_size: 50,
  page_offset: 0,
});
assert(
  !adminJobs.error && Array.isArray(adminJobs.data),
  `Admin job listing failed: ${adminJobs.error?.message ?? "unknown"}`,
);

const memberJobs = await member.rpc("list_admin_jobs", {
  requested_status: null,
  search_text: null,
  page_size: 50,
  page_offset: 0,
});
assert(Boolean(memberJobs.error), "Normal member can list admin jobs.");

const memberAuditRead = await member.from("admin_audit_events").select("id");
assert(
  Boolean(memberAuditRead.error),
  "Normal member has direct SELECT access to admin audit events.",
);

const adminAuditRead = await admin.from("admin_audit_events").select("id");
assert(
  Boolean(adminAuditRead.error),
  "Authenticated admin bypasses the RPC boundary for audit reads.",
);

const memberAuditWrite = await member.from("admin_audit_events").insert({
  actor_user_id: users.member.id,
  action_type: "FORGED",
  target_type: "USER",
  target_id: users.admin.id,
  metadata: {},
});
assert(
  Boolean(memberAuditWrite.error),
  "Normal member can forge admin audit events.",
);

const syntheticAudit = await service.from("admin_audit_events").insert({
  actor_user_id: users.admin.id,
  action_type: "RUNTIME_CHECK",
  target_type: "USER",
  target_id: users.member.id,
  metadata: { source: "phase09-runtime" },
});
assert(
  !syntheticAudit.error,
  `Trusted runtime could not seed audit evidence: ${syntheticAudit.error?.message ?? "unknown"}`,
);

const adminAudit = await admin.rpc("list_admin_audit_events", {
  before_created_at: null,
  page_size: 50,
});
assert(
  !adminAudit.error &&
    adminAudit.data?.some(
      (row) =>
        row.action_type === "RUNTIME_CHECK" &&
        row.actor_user_id === users.admin.id &&
        row.target_id === users.member.id,
    ),
  `Admin audit listing failed: ${adminAudit.error?.message ?? "unknown"}`,
);

const anonymous = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
const anonymousUsers = await anonymous.rpc("list_admin_users", {
  search_text: null,
  page_size: 50,
  page_offset: 0,
});
assert(Boolean(anonymousUsers.error), "Anonymous caller can list admin users.");

const identityProviderSetup = await Promise.all([
  service
    .from("provider_profiles")
    .update({ status: "IDENTITY_PENDING" })
    .eq("user_id", users.member.id),
  service.from("provider_profiles").insert({
    user_id: users.outsider.id,
    status: "IDENTITY_PENDING",
    onboarding_step: 4,
  }),
  service.from("provider_profiles").insert({
    user_id: users.admin.id,
    status: "IDENTITY_PENDING",
    onboarding_step: 4,
  }),
]);
assert(
  identityProviderSetup.every((result) => !result.error),
  `Could not prepare identity review providers: ${identityProviderSetup
    .map((result) => result.error?.message)
    .filter(Boolean)
    .join(", ")}`,
);

const identityDocuments = await service.from("provider_documents").insert([
  {
    user_id: users.member.id,
    document_type: "DNI_FRONT",
    storage_path: `${users.member.id}/runtime-front.jpg`,
    mime_type: "image/jpeg",
    file_size_bytes: 1024,
  },
  {
    user_id: users.outsider.id,
    document_type: "DNI_FRONT",
    storage_path: `${users.outsider.id}/runtime-front.jpg`,
    mime_type: "image/jpeg",
    file_size_bytes: 1024,
  },
]);
assert(
  !identityDocuments.error,
  `Could not seed identity document metadata: ${identityDocuments.error?.message ?? "unknown"}`,
);

const memberIdentityQueue = await member.rpc("list_admin_identity_queue", {
  page_size: 50,
  page_offset: 0,
});
assert(
  Boolean(memberIdentityQueue.error),
  "Normal member can inspect the admin identity queue.",
);

const adminIdentityQueue = await admin.rpc("list_admin_identity_queue", {
  page_size: 50,
  page_offset: 0,
});
assert(
  !adminIdentityQueue.error &&
    adminIdentityQueue.data?.some(
      (row) => row.provider_user_id === users.member.id,
    ) &&
    adminIdentityQueue.data?.some(
      (row) => row.provider_user_id === users.outsider.id,
    ),
  `Admin identity queue failed: ${adminIdentityQueue.error?.message ?? "unknown"}`,
);

const memberCannotReadOutsiderDocument = await member
  .from("provider_documents")
  .select("id,user_id")
  .eq("user_id", users.outsider.id);
assert(
  !memberCannotReadOutsiderDocument.error &&
    memberCannotReadOutsiderDocument.data?.length === 0,
  "Normal member can read another provider identity document metadata.",
);

const adminBrowserDocuments = await admin
  .from("provider_documents")
  .select("id,user_id")
  .eq("user_id", users.member.id);
assert(
  !adminBrowserDocuments.error && adminBrowserDocuments.data?.length === 0,
  "Admin browser session bypasses private document owner RLS.",
);

const identityCaseBefore = await admin.rpc("get_admin_identity_case", {
  target_provider_user_id: users.member.id,
});
const identityCaseJson = JSON.stringify(identityCaseBefore.data ?? []);
assert(
  !identityCaseBefore.error &&
    identityCaseBefore.data?.[0]?.provider_user_id === users.member.id &&
    identityCaseBefore.data?.[0]?.documents?.length === 1 &&
    !identityCaseJson.includes("runtime-front.jpg"),
  `Admin identity case exposed an invalid shape or raw storage path: ${identityCaseBefore.error?.message ?? "unknown"}`,
);

const selfReview = await admin.rpc("decide_provider_identity_review", {
  target_provider_user_id: users.admin.id,
  requested_decision: "APPROVE",
  requested_reason: "Verificación propia no permitida",
});
assert(Boolean(selfReview.error), "Admin provider can approve their own identity.");

const rejectWithoutReason = await admin.rpc(
  "decide_provider_identity_review",
  {
    target_provider_user_id: users.outsider.id,
    requested_decision: "REJECT",
    requested_reason: null,
  },
);
assert(
  Boolean(rejectWithoutReason.error),
  "Identity rejection succeeds without a reason.",
);

const rejectedReview = await admin.rpc("decide_provider_identity_review", {
  target_provider_user_id: users.outsider.id,
  requested_decision: "REJECT",
  requested_reason: "Documento ilegible",
});
assert(
  !rejectedReview.error && Boolean(rejectedReview.data),
  `Admin could not reject identity: ${rejectedReview.error?.message ?? "unknown"}`,
);

const approvedReview = await admin.rpc("decide_provider_identity_review", {
  target_provider_user_id: users.member.id,
  requested_decision: "APPROVE",
  requested_reason: "Identidad verificada manualmente",
});
assert(
  !approvedReview.error && Boolean(approvedReview.data),
  `Admin could not approve identity: ${approvedReview.error?.message ?? "unknown"}`,
);

const resultingProviders = await service
  .from("provider_profiles")
  .select("user_id,status")
  .in("user_id", [users.member.id, users.outsider.id]);
assert(
  !resultingProviders.error &&
    resultingProviders.data?.some(
      (row) => row.user_id === users.member.id && row.status === "ACTIVE",
    ) &&
    resultingProviders.data?.some(
      (row) => row.user_id === users.outsider.id && row.status === "REJECTED",
    ),
  `Identity decisions did not update provider states: ${resultingProviders.error?.message ?? "unknown"}`,
);

const memberCaseAfter = await admin.rpc("get_admin_identity_case", {
  target_provider_user_id: users.member.id,
});
assert(
  !memberCaseAfter.error &&
    memberCaseAfter.data?.[0]?.review_history?.some(
      (row) =>
        row.reviewer_user_id === users.admin.id &&
        row.decision === "APPROVE" &&
        row.previous_status === "IDENTITY_PENDING" &&
        row.new_status === "ACTIVE",
    ),
  `Identity approval history is incomplete: ${memberCaseAfter.error?.message ?? "unknown"}`,
);

const outsiderCaseAfter = await admin.rpc("get_admin_identity_case", {
  target_provider_user_id: users.outsider.id,
});
assert(
  !outsiderCaseAfter.error &&
    outsiderCaseAfter.data?.[0]?.review_history?.some(
      (row) =>
        row.reviewer_user_id === users.admin.id &&
        row.decision === "REJECT" &&
        row.reason === "Documento ilegible" &&
        row.new_status === "REJECTED",
    ),
  `Identity rejection history is incomplete: ${outsiderCaseAfter.error?.message ?? "unknown"}`,
);

const browserIdentityHistory = await admin
  .from("provider_identity_reviews")
  .select("id");
assert(
  Boolean(browserIdentityHistory.error),
  "Authenticated admin can bypass identity review RPCs and read history directly.",
);

const identityAudit = await admin.rpc("list_admin_audit_events", {
  before_created_at: null,
  page_size: 50,
});
assert(
  !identityAudit.error &&
    identityAudit.data?.some(
      (row) =>
        row.action_type === "IDENTITY_REVIEW_APPROVED" &&
        row.target_id === users.member.id,
    ) &&
    identityAudit.data?.some(
      (row) =>
        row.action_type === "IDENTITY_REVIEW_REJECTED" &&
        row.target_id === users.outsider.id,
    ),
  `Identity review audit evidence is incomplete: ${identityAudit.error?.message ?? "unknown"}`,
);

console.log(
  "Phase 09 admin runtime checks passed: RBAC, audit isolation, identity queue/decisions and private document boundaries are server-enforced.",
);

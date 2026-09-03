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

console.log(
  "Phase 09 admin runtime checks passed: RBAC, bounded admin reads and audit isolation are server-enforced.",
);

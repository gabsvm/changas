import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase API_URL, ANON_KEY, and SERVICE_ROLE_KEY are required for Phase 11 runtime checks.",
  );
}

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const runId = crypto.randomUUID();
const password = `Phase11-${runId}-ValidPassword!`;
const users = {
  admin: { email: `phase11-admin-${runId}@example.test` },
  client: { email: `phase11-client-${runId}@example.test` },
  provider: { email: `phase11-provider-${runId}@example.test` },
  outsider: { email: `phase11-outsider-${runId}@example.test` },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function step(name) {
  console.log(`Phase 11 :: ${name}`);
}

async function createUser(user) {
  const { data, error } = await service.auth.admin.createUser({
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
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password,
  });
  assert(!error && data.session, `Could not sign in ${user.email}: ${error?.message ?? "unknown"}`);
  return client;
}

async function insert(table, payload) {
  const result = await service.from(table).insert(payload);
  assert(!result.error, `${table} insert failed: ${result.error?.message ?? "unknown"}`);
}

for (const user of Object.values(users)) await createUser(user);
const client = await signIn(users.client);
const admin = await signIn(users.admin);
const outsider = await signIn(users.outsider);

step("fixture and seller account");
let result = await service
  .from("skills")
  .select("id")
  .eq("is_active", true)
  .order("sort_order")
  .limit(1)
  .single();
assert(!result.error && result.data?.id, "Phase 11 requires one active skill");
const skillId = result.data.id;

await insert("provider_profiles", {
  user_id: users.provider.id,
  status: "ACTIVE",
  onboarding_step: 4,
  public_slug: `phase11-${runId}`,
  public_headline: "Phase 11 payment provider",
});
await insert("provider_skills", {
  provider_user_id: users.provider.id,
  skill_id: skillId,
});

const serviceId = crypto.randomUUID();
await insert("services", {
  id: serviceId,
  provider_user_id: users.provider.id,
  skill_id: skillId,
  public_slug: `phase11-service-${runId}`,
  title: "Phase 11 payment service",
  description: "Synthetic service for real-provider payment contracts.",
  modality: "REMOTE",
  price_model: "FIXED",
  price_amount: 100000,
  currency_code: "ARS",
  accepts_offers: false,
  schedule_type: "UNSCHEDULED",
  is_published: true,
});

const conversationId = crypto.randomUUID();
await insert("conversations", {
  id: conversationId,
  service_id: serviceId,
  client_user_id: users.client.id,
  provider_user_id: users.provider.id,
  status: "OPEN",
});

const proposalId = crypto.randomUUID();
const versionId = crypto.randomUUID();
await insert("proposals", {
  id: proposalId,
  conversation_id: conversationId,
  service_id: serviceId,
  client_user_id: users.client.id,
  provider_user_id: users.provider.id,
  kind: "PROVIDER_QUOTE",
  status: "AWAITING_PAYMENT",
  created_by_user_id: users.provider.id,
});
await insert("proposal_versions", {
  id: versionId,
  proposal_id: proposalId,
  version_number: 1,
  kind: "PROVIDER_QUOTE",
  authored_by_user_id: users.provider.id,
  service_title_snapshot: "Phase 11 payment service",
  service_description_snapshot: "Synthetic payment contract.",
  modality: "REMOTE",
  scope_snapshot: "Phase 11 original scope",
  price_model_snapshot: "FIXED",
  price_amount: 100000,
  currency_code: "ARS",
  schedule_type: "UNSCHEDULED",
});
result = await service
  .from("proposals")
  .update({ current_version_id: versionId, accepted_version_id: versionId })
  .eq("id", proposalId);
assert(!result.error, `Proposal snapshot update failed: ${result.error?.message ?? "unknown"}`);

const account = await service.rpc("upsert_payment_provider_account", {
  target_provider_user_id: users.provider.id,
  payment_provider_name: "MERCADO_PAGO",
  payment_provider_account_reference: `seller-${runId}`,
  encrypted_access_token_ciphertext: "runtime-access-ciphertext",
  encrypted_access_token_iv: "runtime-access-iv",
  encrypted_access_token_auth_tag: "runtime-access-tag",
  encrypted_refresh_token_ciphertext: "runtime-refresh-ciphertext",
  encrypted_refresh_token_iv: "runtime-refresh-iv",
  encrypted_refresh_token_auth_tag: "runtime-refresh-tag",
  token_encryption_key_version: 1,
  granted_scope: null,
  access_token_expires_at: null,
  account_status: "CONNECTED",
});
assert(!account.error && account.data, `Seller account failed: ${account.error?.message ?? "unknown"}`);
const paymentProviderAccountId = account.data;

step("proposal checkout browser cannot mutate financial truth");
const checkoutId = crypto.randomUUID();
const checkoutNonce = crypto.randomUUID();
await insert("payment_checkout_sessions", {
  id: checkoutId,
  request_nonce: checkoutNonce,
  purpose: "PROPOSAL",
  proposal_id: proposalId,
  client_user_id: users.client.id,
  provider_user_id: users.provider.id,
  payment_provider_account_id: paymentProviderAccountId,
  provider_name: "MERCADO_PAGO",
  provider_checkout_reference: `preference-${runId}`,
  external_reference: `phase11:proposal:${runId}`,
  amount_minor: 100000,
  marketplace_fee_minor: 10000,
  provider_net_expected_minor: 90000,
  currency_code: "ARS",
  status: "REDIRECT_READY",
  checkout_url: "https://example.test/phase11-checkout",
});

const spoof = await client
  .from("payment_checkout_sessions")
  .update({ status: "COMPLETED" })
  .eq("id", checkoutId);
assert(spoof.error, "Browser role unexpectedly mutated hosted checkout state");
result = await service.from("payment_attempts").select("id").eq("proposal_id", proposalId);
assert(!result.error && result.data.length === 0, "Redirect/browser state created a payment attempt");

step("authoritative pending to success and idempotent ledger");
let reconciliation = await service.rpc("reconcile_provider_payment", {
  target_checkout_session_id: checkoutId,
  payment_provider_name: "MERCADO_PAGO",
  payment_provider_reference: `payment-${runId}`,
  payment_result_status: "PENDING",
  payment_amount_minor: 100000,
  payment_currency_code: "ARS",
  payment_provider_account_reference: `seller-${runId}`,
  source_provider_event_id: null,
});
assert(!reconciliation.error, `Pending reconciliation failed: ${reconciliation.error?.message ?? "unknown"}`);

reconciliation = await service.rpc("reconcile_provider_payment", {
  target_checkout_session_id: checkoutId,
  payment_provider_name: "MERCADO_PAGO",
  payment_provider_reference: `payment-${runId}`,
  payment_result_status: "SUCCEEDED",
  payment_amount_minor: 100000,
  payment_currency_code: "ARS",
  payment_provider_account_reference: `seller-${runId}`,
  source_provider_event_id: null,
});
assert(!reconciliation.error, `Success reconciliation failed: ${reconciliation.error?.message ?? "unknown"}`);

result = await service
  .from("payment_attempts")
  .select("id,status")
  .eq("proposal_id", proposalId)
  .single();
assert(!result.error && result.data.status === "SUCCEEDED", "Proposal payment did not succeed");
const paymentAttemptId = result.data.id;

await service.rpc("reconcile_provider_payment", {
  target_checkout_session_id: checkoutId,
  payment_provider_name: "MERCADO_PAGO",
  payment_provider_reference: `payment-${runId}`,
  payment_result_status: "SUCCEEDED",
  payment_amount_minor: 100000,
  payment_currency_code: "ARS",
  payment_provider_account_reference: `seller-${runId}`,
  source_provider_event_id: null,
});
result = await service
  .from("financial_ledger_entries")
  .select("entry_type,amount_minor")
  .eq("payment_attempt_id", paymentAttemptId);
assert(!result.error && result.data.length === 3, "Proposal ledger is not exactly-once");

step("provider observation and mismatch visibility");
let observation = await service.rpc("record_payment_reconciliation_observation", {
  target_checkout_session_id: checkoutId,
  observed_provider_status: "SUCCEEDED",
  observed_provider_status_detail: "accredited",
  observed_amount_minor: 100000,
  observed_currency_code: "ARS",
  observed_provider_account_reference: `seller-${runId}`,
  observed_refunded_minor: 0,
  observed_provider_net_received_minor: 86500,
});
assert(!observation.error && observation.data === false, "Matching provider observation was flagged");

observation = await service.rpc("record_payment_reconciliation_observation", {
  target_checkout_session_id: checkoutId,
  observed_provider_status: "SUCCEEDED",
  observed_provider_status_detail: "accredited",
  observed_amount_minor: 99999,
  observed_currency_code: "ARS",
  observed_provider_account_reference: `seller-${runId}`,
  observed_refunded_minor: 0,
  observed_provider_net_received_minor: 86500,
});
assert(!observation.error && observation.data === true, "Amount mismatch was not persisted");

step("participant-safe receipt and access denial");
let receipt = await client.rpc("get_my_payment_receipt", {
  target_payment_attempt_id: paymentAttemptId,
});
assert(!receipt.error && receipt.data?.providerReference === `payment-${runId}`, "Client receipt missing provider reference");
assert(!JSON.stringify(receipt.data).includes("ciphertext"), "Receipt leaked encrypted credentials");
const deniedReceipt = await outsider.rpc("get_my_payment_receipt", {
  target_payment_attempt_id: paymentAttemptId,
});
assert(deniedReceipt.error, "Unrelated user unexpectedly read payment receipt");

step("partial refund creates reversal ledger only after provider confirmation");
const refundNonce = crypto.randomUUID();
let refund = await service.rpc("create_payment_refund_request", {
  target_payment_attempt_id: paymentAttemptId,
  refund_request_nonce: refundNonce,
  requested_by_user_id: users.client.id,
  requested_amount_minor: 25000,
});
assert(!refund.error && refund.data?.id, `Refund request failed: ${refund.error?.message ?? "unknown"}`);
const refundId = refund.data.id;
await service.rpc("set_payment_refund_provider_result", {
  target_refund_id: refundId,
  payment_provider_refund_reference: `refund-${runId}`,
  target_status: "PENDING",
  target_reason_code: null,
  source_provider_event_id: null,
});
result = await service.from("financial_ledger_entries").select("id").eq("refund_id", refundId);
assert(!result.error && result.data.length === 0, "Pending refund created reversal ledger");
refund = await service.rpc("set_payment_refund_provider_result", {
  target_refund_id: refundId,
  payment_provider_refund_reference: `refund-${runId}`,
  target_status: "SUCCEEDED",
  target_reason_code: null,
  source_provider_event_id: null,
});
assert(!refund.error, `Refund reconciliation failed: ${refund.error?.message ?? "unknown"}`);
result = await service.from("financial_ledger_entries").select("id").eq("refund_id", refundId);
assert(!result.error && result.data.length === 3, "Successful partial refund did not append three reversal effects");

receipt = await client.rpc("get_my_payment_receipt", {
  target_payment_attempt_id: paymentAttemptId,
});
assert(!receipt.error && Number(receipt.data?.refundedMinor) === 25000, "Receipt did not reflect successful refund");

step("additional scope checkout uses the same authoritative reconciliation boundary");
result = await service
  .from("jobs")
  .select("id")
  .eq("payment_attempt_id", paymentAttemptId)
  .single();
assert(!result.error && result.data?.id, "Successful payment did not create job");
const jobId = result.data.id;
const scopeChangeId = crypto.randomUUID();
await insert("job_scope_changes", {
  id: scopeChangeId,
  job_id: jobId,
  requested_by_user_id: users.provider.id,
  status: "AWAITING_PAYMENT",
  scope_snapshot: "Phase 11 additional scope",
  additional_amount_minor: 25000,
  currency_code: "ARS",
});

const additionalCheckoutId = crypto.randomUUID();
const additionalNonce = crypto.randomUUID();
await insert("payment_checkout_sessions", {
  id: additionalCheckoutId,
  request_nonce: additionalNonce,
  purpose: "SCOPE_CHANGE",
  scope_change_id: scopeChangeId,
  client_user_id: users.client.id,
  provider_user_id: users.provider.id,
  payment_provider_account_id: paymentProviderAccountId,
  provider_name: "MERCADO_PAGO",
  provider_checkout_reference: `preference-extra-${runId}`,
  external_reference: `phase11:scope:${runId}`,
  amount_minor: 25000,
  marketplace_fee_minor: 2500,
  provider_net_expected_minor: 22500,
  currency_code: "ARS",
  status: "REDIRECT_READY",
  checkout_url: "https://example.test/phase11-extra-checkout",
});

for (const status of ["PENDING", "SUCCEEDED"]) {
  const additionalResult = await service.rpc("reconcile_provider_payment", {
    target_checkout_session_id: additionalCheckoutId,
    payment_provider_name: "MERCADO_PAGO",
    payment_provider_reference: `payment-extra-${runId}`,
    payment_result_status: status,
    payment_amount_minor: 25000,
    payment_currency_code: "ARS",
    payment_provider_account_reference: `seller-${runId}`,
    source_provider_event_id: null,
  });
  assert(!additionalResult.error, `Additional ${status} reconciliation failed: ${additionalResult.error?.message ?? "unknown"}`);
}
result = await service
  .from("job_additional_payment_attempts")
  .select("id,status")
  .eq("scope_change_id", scopeChangeId)
  .single();
assert(!result.error && result.data.status === "SUCCEEDED", "Additional charge did not succeed");
const additionalAttemptId = result.data.id;
result = await service
  .from("financial_ledger_entries")
  .select("entry_type")
  .eq("additional_payment_attempt_id", additionalAttemptId);
assert(!result.error && result.data.length === 3, "Additional charge ledger is incomplete");
result = await service
  .from("payment_settlements")
  .select("id")
  .eq("additional_payment_attempt_id", additionalAttemptId)
  .single();
assert(!result.error && result.data?.id, "Additional charge settlement snapshot is missing");

step("admin reconciliation visibility and RBAC");
result = await service.from("user_roles").update({ role: "admin" }).eq("user_id", users.admin.id);
assert(!result.error, `Admin promotion failed: ${result.error?.message ?? "unknown"}`);
const reconciliationRun = await service.rpc("start_payment_reconciliation_run", {
  reconciliation_initiated_by_user_id: users.admin.id,
  reconciliation_initiator_type: "ADMIN",
  reconciliation_provider_name: "MERCADO_PAGO",
  reconciliation_range_start: null,
  reconciliation_range_end: null,
});
assert(!reconciliationRun.error && reconciliationRun.data, "Could not start reconciliation run");
const finished = await service.rpc("finish_payment_reconciliation_run", {
  target_run_id: reconciliationRun.data,
  target_checked_count: 2,
  target_matched_count: 1,
  target_mismatched_count: 1,
  target_failed_count: 0,
  target_error_summary: null,
});
assert(!finished.error, `Could not finish reconciliation run: ${finished.error?.message ?? "unknown"}`);

const adminPayments = await admin.rpc("list_admin_payment_finance", {
  page_size: 50,
  page_offset: 0,
});
assert(!adminPayments.error && adminPayments.data?.length >= 1, "Admin payment read model is empty");
const targetAdminPayment = adminPayments.data.find((row) => row.payment_attempt_id === paymentAttemptId);
assert(targetAdminPayment?.mismatch_flag === true, "Admin read model did not expose reconciliation mismatch");
const serializedAdmin = JSON.stringify(adminPayments.data);
assert(!serializedAdmin.includes("access_token"), "Admin payment read model leaked access-token fields");
assert(!serializedAdmin.includes("refresh_token"), "Admin payment read model leaked refresh-token fields");
assert(!serializedAdmin.includes("ciphertext"), "Admin payment read model leaked encrypted credentials");

const adminRuns = await admin.rpc("list_admin_payment_reconciliation_runs", { page_size: 20 });
assert(!adminRuns.error && adminRuns.data.some((row) => row.run_id === reconciliationRun.data), "Admin cannot inspect reconciliation runs");
const memberAdminRead = await client.rpc("list_admin_payment_finance", { page_size: 50, page_offset: 0 });
assert(memberAdminRead.error, "Normal member unexpectedly read admin payment finance data");

console.log("Phase 11 payment runtime checks passed.");

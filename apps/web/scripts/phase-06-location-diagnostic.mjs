import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Local Supabase credentials are required.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = crypto.randomUUID();
const password = `Phase06-location-${runId}-Password1!`;
const users = {
  client: { email: `phase06-location-client-${runId}@example.test` },
  provider: { email: `phase06-location-provider-${runId}@example.test` },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function makeUser(user) {
  const created = await admin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
  });
  assert(
    !created.error && created.data.user,
    `create user: ${created.error?.message}`,
  );
  user.id = created.data.user.id;

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await client.auth.signInWithPassword({
    email: user.email,
    password,
  });
  assert(!signedIn.error, `sign in: ${signedIn.error?.message}`);
  return client;
}

const client = await makeUser(users.client);
const provider = await makeUser(users.provider);
const skill = await admin
  .from("skills")
  .select("id")
  .eq("slug", "reparacion-pc")
  .single();
assert(!skill.error && skill.data?.id, "missing skill");

const providerSlug = `phase06-location-provider-${runId}`;
const serviceSlug = `phase06-location-service-${runId}`;
assert(
  !(
    await admin.from("provider_profiles").insert({
      user_id: users.provider.id,
      status: "ACTIVE",
      onboarding_step: 4,
      public_slug: providerSlug,
    })
  ).error,
  "provider profile failed",
);
assert(
  !(
    await admin.from("provider_skills").insert({
      provider_user_id: users.provider.id,
      skill_id: skill.data.id,
      is_featured: true,
    })
  ).error,
  "provider skill failed",
);
const service = await admin
  .from("services")
  .insert({
    provider_user_id: users.provider.id,
    skill_id: skill.data.id,
    public_slug: serviceSlug,
    title: "Phase 06 location diagnostic",
    description: "Synthetic service for exact-location diagnostics.",
    modality: "IN_PERSON",
    price_model: "FIXED",
    price_amount: 100000,
    currency_code: "ARS",
    schedule_type: "FIXED_SLOT",
    expected_duration_minutes: 60,
    is_published: true,
    is_paused: false,
  })
  .select("id")
  .single();
assert(
  !service.error && service.data?.id,
  `service failed: ${service.error?.message}`,
);

const conversation = await client.rpc("start_service_conversation", {
  target_provider_slug: providerSlug,
  target_service_slug: serviceSlug,
});
assert(
  !conversation.error && conversation.data,
  `conversation: ${conversation.error?.message}`,
);
const proposal = await client.rpc("create_conversation_proposal", {
  target_conversation_id: conversation.data,
  requested_kind: "DIRECT_BOOKING",
  scope_text: "Location diagnostic scope",
  proposed_price_amount: null,
  proposed_schedule_start_at: "2026-09-06T15:00:00.000Z",
  proposed_schedule_end_at: "2026-09-06T16:00:00.000Z",
  proposed_deadline_at: null,
  proposal_expires_at: null,
});
assert(
  !proposal.error && proposal.data,
  `proposal: ${proposal.error?.message}`,
);
const paid = await admin.rpc("apply_fake_payment_result", {
  target_proposal_id: proposal.data,
  payment_nonce: crypto.randomUUID(),
  payment_outcome: "SUCCESS",
  actor_client_user_id: users.client.id,
});
const jobId = paid.data?.[0]?.confirmed_job_id;
assert(!paid.error && jobId, `payment: ${paid.error?.message}`);

const write = await client.rpc("set_job_exact_location", {
  target_job_id: jobId,
  exact_address_text: "Av. Corrientes 1234, CABA",
  lat: -34.6037,
  lng: -58.3816,
  notes: "Timbre 4B",
});
assert(!write.error, `location write: ${write.error?.message}`);

const [
  adminJob,
  adminLocation,
  clientLocation,
  providerLocation,
  clientDetail,
  providerDetail,
] = await Promise.all([
  admin
    .from("jobs")
    .select("id,status,client_user_id,provider_user_id")
    .eq("id", jobId)
    .single(),
  admin
    .from("job_private_locations")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle(),
  client
    .from("job_private_locations")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle(),
  provider
    .from("job_private_locations")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle(),
  client.rpc("get_job_detail", { target_job_id: jobId }),
  provider.rpc("get_job_detail", { target_job_id: jobId }),
]);

const diagnostic = {
  expectedProviderId: users.provider.id,
  adminJob: { data: adminJob.data, error: adminJob.error?.message ?? null },
  adminLocation: {
    data: adminLocation.data,
    error: adminLocation.error?.message ?? null,
  },
  clientLocation: {
    data: clientLocation.data,
    error: clientLocation.error?.message ?? null,
  },
  providerLocation: {
    data: providerLocation.data,
    error: providerLocation.error?.message ?? null,
  },
  clientDetail: {
    data: clientDetail.data,
    error: clientDetail.error?.message ?? null,
  },
  providerDetail: {
    data: providerDetail.data,
    error: providerDetail.error?.message ?? null,
  },
};

console.log("PHASE06_LOCATION_DIAGNOSTIC", JSON.stringify(diagnostic));
assert(
  providerDetail.data?.[0]?.exact_address === "Av. Corrientes 1234, CABA",
  "Confirmed provider location diagnostic reproduced the visibility failure.",
);

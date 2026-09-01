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

async function createService({ slug, title, modality, scheduleType }) {
  const service = await admin
    .from("services")
    .insert({
      provider_user_id: users.provider.id,
      skill_id: skill.data.id,
      public_slug: slug,
      title,
      description: `Synthetic ${modality} service for exact-location runtime security checks.`,
      modality,
      price_model: "FIXED",
      price_amount: 100000,
      currency_code: "ARS",
      schedule_type: scheduleType,
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
  return service.data.id;
}

async function createPaidJob({ serviceSlug, scope, startsAt, endsAt }) {
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
    scope_text: scope,
    proposed_price_amount: null,
    proposed_schedule_start_at: startsAt ?? null,
    proposed_schedule_end_at: endsAt ?? null,
    proposed_deadline_at: null,
    proposal_expires_at: null,
  });
  assert(
    !proposal.error && proposal.data,
    `proposal: ${proposal.error?.message}`,
  );
  const paid = await admin.rpc("apply_payment_result", {
    target_proposal_id: proposal.data,
    payment_nonce: crypto.randomUUID(),
    payment_provider_name: "RUNTIME",
    payment_provider_reference: `location-${crypto.randomUUID()}`,
    payment_result_status: "SUCCEEDED",
    actor_client_user_id: users.client.id,
  });
  const jobId = paid.data?.[0]?.confirmed_job_id;
  assert(!paid.error && jobId, `payment: ${paid.error?.message}`);
  return jobId;
}

const inPersonSlug = `phase06-location-in-person-${runId}`;
await createService({
  slug: inPersonSlug,
  title: "Phase 06 in-person location runtime",
  modality: "IN_PERSON",
  scheduleType: "FIXED_SLOT",
});
const inPersonJobId = await createPaidJob({
  serviceSlug: inPersonSlug,
  scope: "In-person location runtime scope",
  startsAt: "2026-09-06T15:00:00.000Z",
  endsAt: "2026-09-06T16:00:00.000Z",
});

const inPersonWrite = await client.rpc("set_job_exact_location", {
  target_job_id: inPersonJobId,
  exact_address_text: "Av. Corrientes 1234, CABA",
  lat: -34.6037,
  lng: -58.3816,
  notes: "Timbre 4B",
});
assert(
  !inPersonWrite.error,
  `in-person location write: ${inPersonWrite.error?.message}`,
);

const [clientDetail, providerDetail] = await Promise.all([
  client.rpc("get_job_detail", { target_job_id: inPersonJobId }),
  provider.rpc("get_job_detail", { target_job_id: inPersonJobId }),
]);
assert(
  !clientDetail.error &&
    clientDetail.data?.[0]?.exact_address === "Av. Corrientes 1234, CABA",
  `Client cannot read in-person exact location: ${clientDetail.error?.message ?? "unknown"}`,
);
assert(
  !providerDetail.error &&
    providerDetail.data?.[0]?.exact_address === "Av. Corrientes 1234, CABA",
  `Confirmed provider cannot read in-person exact location: ${providerDetail.error?.message ?? "unknown"}`,
);

const remoteSlug = `phase06-location-remote-${runId}`;
await createService({
  slug: remoteSlug,
  title: "Phase 06 remote location runtime",
  modality: "REMOTE",
  scheduleType: "UNSCHEDULED",
});
const remoteJobId = await createPaidJob({
  serviceSlug: remoteSlug,
  scope: "Remote location runtime scope",
  startsAt: null,
  endsAt: null,
});

const remoteWrite = await client.rpc("set_job_exact_location", {
  target_job_id: remoteJobId,
  exact_address_text: "Dirección que un trabajo remoto no debe necesitar",
  lat: -34.6037,
  lng: -58.3816,
  notes: "Debe rechazarse",
});
assert(Boolean(remoteWrite.error), "REMOTE job accepted an exact on-site location.");

const remoteLegacyLocation = await admin.from("job_private_locations").upsert({
  job_id: remoteJobId,
  client_user_id: users.client.id,
  exact_address: "Legacy secret address",
  latitude: -34.6037,
  longitude: -58.3816,
  access_notes: "Legacy row must not leak",
});
assert(
  !remoteLegacyLocation.error,
  `Could not create remote legacy location fixture: ${remoteLegacyLocation.error?.message}`,
);

const remoteProviderDetail = await provider.rpc("get_job_detail", {
  target_job_id: remoteJobId,
});
assert(
  !remoteProviderDetail.error &&
    remoteProviderDetail.data?.[0]?.exact_address === null &&
    remoteProviderDetail.data?.[0]?.exact_latitude === null &&
    remoteProviderDetail.data?.[0]?.exact_longitude === null &&
    remoteProviderDetail.data?.[0]?.access_notes === null,
  "REMOTE job leaked an exact location to the provider.",
);

console.log("Phase 06 exact-location runtime security checks: PASS");

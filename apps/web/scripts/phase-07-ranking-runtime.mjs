import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase credentials are required for Phase 07 ranking runtime checks.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
const anonymous = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const runId = crypto.randomUUID();
const compactRunId = runId.replaceAll("-", "");
const password = `Phase07-ranking-${runId}-valid-password`;
const users = {
  client: { email: `phase07-ranking-client-${runId}@example.test` },
  low: { email: `phase07-ranking-low-${runId}@example.test` },
  high: { email: `phase07-ranking-high-${runId}@example.test` },
  ops: { email: `phase07-ranking-ops-${runId}@example.test` },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function approximately(actual, expected, tolerance = 0.0001) {
  return Math.abs(Number(actual) - expected) <= tolerance;
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

await Promise.all(Object.values(users).map(createUser));
const [client, lowProvider, highProvider, opsProvider] = await Promise.all([
  signIn(users.client),
  signIn(users.low),
  signIn(users.high),
  signIn(users.ops),
]);

const categorySlug = `phase07-ranking-${compactRunId}`;
const skillSlug = `phase07-skill-${compactRunId}`;
const category = await admin
  .from("categories")
  .insert({
    slug: categorySlug,
    name: `Phase 07 ranking ${compactRunId.slice(0, 8)}`,
    description: "Categoría sintética para aislar el ranking reputacional Phase 07.",
    is_active: true,
  })
  .select("id")
  .single();
assert(
  !category.error && category.data?.id,
  `Could not create ranking category: ${category.error?.message ?? "unknown"}`,
);
const skill = await admin
  .from("skills")
  .insert({
    category_id: category.data.id,
    slug: skillSlug,
    name: `Skill ranking ${compactRunId.slice(0, 8)}`,
    description: "Skill sintética para comparar señales reputacionales homogéneas.",
    is_active: true,
  })
  .select("id")
  .single();
assert(
  !skill.error && skill.data?.id,
  `Could not create ranking skill: ${skill.error?.message ?? "unknown"}`,
);

async function createProviderFixture(user, label, clientHandle) {
  const providerSlug = `phase07-${label}-${compactRunId}`;
  const serviceSlug = `service-${label}-${compactRunId}`;
  const profileInsert = await admin.from("provider_profiles").insert({
    user_id: user.id,
    status: "ACTIVE",
    onboarding_step: 4,
    public_slug: providerSlug,
    public_headline: `Proveedor ${label} para ranking Phase 07`,
  });
  assert(
    !profileInsert.error,
    `Could not create ${label} provider profile: ${profileInsert.error?.message ?? "unknown"}`,
  );
  const providerSkill = await admin.from("provider_skills").insert({
    provider_user_id: user.id,
    skill_id: skill.data.id,
    is_featured: true,
  });
  assert(
    !providerSkill.error,
    `Could not attach ${label} provider skill: ${providerSkill.error?.message ?? "unknown"}`,
  );
  const service = await admin
    .from("services")
    .insert({
      provider_user_id: user.id,
      skill_id: skill.data.id,
      public_slug: serviceSlug,
      title: `Servicio ranking ${label}`,
      description:
        "Servicio sintético homogéneo para verificar ranking reputacional sin diferencias materiales de relevancia.",
      modality: "REMOTE",
      price_model: "FIXED",
      price_amount: 100000,
      currency_code: "ARS",
      accepts_offers: true,
      schedule_type: "UNSCHEDULED",
      is_published: true,
      is_paused: false,
    })
    .select("id")
    .single();
  assert(
    !service.error && service.data?.id,
    `Could not create ${label} service: ${service.error?.message ?? "unknown"}`,
  );
  return {
    user,
    client: clientHandle,
    providerSlug,
    serviceSlug,
    serviceId: service.data.id,
  };
}

const [low, high, ops] = await Promise.all([
  createProviderFixture(users.low, "low", lowProvider),
  createProviderFixture(users.high, "high", highProvider),
  createProviderFixture(users.ops, "ops", opsProvider),
]);

async function createPaidJob(providerFixture, suffix) {
  const started = await client.rpc("start_service_conversation", {
    target_provider_slug: providerFixture.providerSlug,
    target_service_slug: providerFixture.serviceSlug,
  });
  assert(
    !started.error && started.data,
    `Conversation ${suffix} failed: ${started.error?.message ?? "unknown"}`,
  );
  const proposal = await client.rpc("create_conversation_proposal", {
    target_conversation_id: started.data,
    requested_kind: "DIRECT_BOOKING",
    scope_text: `Trabajo ranking Phase 07 ${suffix}`,
    proposed_price_amount: null,
    proposed_schedule_start_at: null,
    proposed_schedule_end_at: null,
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
  return paid.data[0].confirmed_job_id;
}

async function completeJob(providerFixture, jobId) {
  const started = await providerFixture.client.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: "CONFIRMED",
    requested_status: "IN_PROGRESS",
    transition_reason: null,
  });
  assert(
    !started.error && started.data === "IN_PROGRESS",
    `Could not start completed fixture: ${started.error?.message ?? "unknown"}`,
  );
  const requested = await providerFixture.client.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: "IN_PROGRESS",
    requested_status: "COMPLETION_REQUESTED",
    transition_reason: null,
  });
  assert(
    !requested.error && requested.data === "COMPLETION_REQUESTED",
    `Could not request completion: ${requested.error?.message ?? "unknown"}`,
  );
  const completed = await client.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: "COMPLETION_REQUESTED",
    requested_status: "COMPLETED",
    transition_reason: null,
  });
  assert(
    !completed.error && completed.data === "COMPLETED",
    `Could not complete fixture: ${completed.error?.message ?? "unknown"}`,
  );
}

async function reviewJob(jobId, rating, text) {
  const review = await client.rpc("create_job_review", {
    target_job_id: jobId,
    requested_rating: rating,
    requested_review_text: text,
    requested_quality_rating: rating,
    requested_punctuality_rating: rating,
    requested_communication_rating: rating,
  });
  assert(
    !review.error && review.data,
    `Could not review completed fixture: ${review.error?.message ?? "unknown"}`,
  );
  return review.data;
}

const lowJob = await createPaidJob(low, "low-completed");
await completeJob(low, lowJob);
await reviewJob(lowJob, 5, "Cinco estrellas con una sola observación.");

const highJobs = [];
for (let index = 0; index < 3; index += 1) {
  const jobId = await createPaidJob(high, `high-completed-${index}`);
  await completeJob(high, jobId);
  await reviewJob(jobId, 5, `Cinco estrellas verificadas ${index + 1}.`);
  highJobs.push(jobId);
}

const opsCompletedJobs = [];
for (let index = 0; index < 2; index += 1) {
  const jobId = await createPaidJob(ops, `ops-completed-${index}`);
  await completeJob(ops, jobId);
  opsCompletedJobs.push(jobId);
}
await reviewJob(opsCompletedJobs[0], 4, "Cuatro estrellas para fijar un prior no perfecto.");

const cancelledJob = await createPaidJob(ops, "ops-cancelled");
const cancelled = await client.rpc("transition_job_status", {
  target_job_id: cancelledJob,
  expected_status: "CONFIRMED",
  requested_status: "CANCELLED",
  transition_reason: "Cancelación sintética para medir tasa operativa.",
});
assert(
  !cancelled.error && cancelled.data === "CANCELLED",
  `Could not cancel ranking fixture: ${cancelled.error?.message ?? "unknown"}`,
);

const noShowJob = await createPaidJob(ops, "ops-no-show");
const noShow = await ops.client.rpc("transition_job_status", {
  target_job_id: noShowJob,
  expected_status: "CONFIRMED",
  requested_status: "NO_SHOW",
  transition_reason: "No-show sintético para medir tasa operativa.",
});
assert(
  !noShow.error && noShow.data === "NO_SHOW",
  `Could not record ranking no-show: ${noShow.error?.message ?? "unknown"}`,
);

const opsSummary = await anonymous.rpc("get_public_provider_reputation", {
  target_provider_slug: ops.providerSlug,
});
const opsMetrics = opsSummary.data?.[0];
assert(
  !opsSummary.error &&
    opsMetrics?.completed_jobs === 2 &&
    opsMetrics?.observed_jobs === 4 &&
    opsMetrics?.cancellation_count === 1 &&
    opsMetrics?.no_show_count === 1 &&
    opsMetrics?.repeat_client_count === 1 &&
    approximately(opsMetrics?.completion_rate, 0.5) &&
    approximately(opsMetrics?.cancellation_rate, 0.25) &&
    approximately(opsMetrics?.no_show_rate, 0.25),
  `Operational reputation metrics are wrong: ${JSON.stringify(opsMetrics)}`,
);

const [lowSummary, highSummary] = await Promise.all([
  anonymous.rpc("get_public_provider_reputation", {
    target_provider_slug: low.providerSlug,
  }),
  anonymous.rpc("get_public_provider_reputation", {
    target_provider_slug: high.providerSlug,
  }),
]);
const lowMetrics = lowSummary.data?.[0];
const highMetrics = highSummary.data?.[0];
assert(
  !lowSummary.error &&
    !highSummary.error &&
    lowMetrics?.rating_average === 5 &&
    highMetrics?.rating_average === 5 &&
    highMetrics?.review_count === 3 &&
    lowMetrics?.review_count === 1 &&
    Number(highMetrics?.adjusted_rating) > Number(lowMetrics?.adjusted_rating),
  "Bayesian reputation did not distinguish equal raw ratings by verified sample size.",
);
assert(
  highMetrics?.completed_jobs === 3 && highMetrics?.repeat_client_count === 1,
  "High-confidence provider lost completed/repeat-client history.",
);

const highContexts = await anonymous.rpc(
  "list_public_provider_reputation_context",
  { target_provider_slug: high.providerSlug },
);
assert(
  !highContexts.error &&
    highContexts.data?.some(
      (row) =>
        row.context_type === "SKILL" &&
        row.context_slug === skillSlug &&
        row.review_count === 3,
    ) &&
    highContexts.data?.some(
      (row) =>
        row.context_type === "SERVICE" &&
        row.context_slug === high.serviceSlug &&
        row.review_count === 3,
    ),
  "Skill/service contextual reputation aggregates are incomplete.",
);

const publicReviews = await anonymous.rpc("list_public_provider_reviews", {
  target_provider_slug: high.providerSlug,
  skill_filter: skillSlug,
  service_filter: high.serviceSlug,
  page_size: 20,
});
assert(
  !publicReviews.error &&
    publicReviews.data?.length === 3 &&
    publicReviews.data.every(
      (review) =>
        review.service_slug === high.serviceSlug &&
        review.skill_slug === skillSlug &&
        review.category_slug === categorySlug,
    ),
  "Anonymous safe review read lost verified service/skill/category context.",
);
const rawReviews = await anonymous.from("reviews").select("id");
assert(Boolean(rawReviews.error), "Anonymous caller can read the raw reviews table.");

async function discovery(sortKey) {
  return anonymous.rpc("search_discovery_services_v4", {
    query_text: skillSlug,
    skill_filter: skillSlug,
    sort_key: sortKey,
    page_number: 1,
    page_size: 24,
  });
}

const bestRated = await discovery("best-rated");
assert(
  !bestRated.error && bestRated.data?.[0]?.provider_slug === high.providerSlug,
  `best-rated ignored confidence-adjusted rating: ${JSON.stringify(bestRated.data)}`,
);
assert(
  bestRated.data?.[0]?.rating_average === 5 &&
    bestRated.data?.[0]?.review_count === 3 &&
    bestRated.data?.[0]?.completed_jobs === 3,
  "Discovery V4 did not expose understandable reputation card signals.",
);

const mostCompleted = await discovery("most-completed");
assert(
  !mostCompleted.error &&
    mostCompleted.data?.map((row) => row.provider_slug).slice(0, 3).join(",") ===
      [high.providerSlug, ops.providerSlug, low.providerSlug].join(","),
  `most-completed order is wrong: ${JSON.stringify(mostCompleted.data)}`,
);

const recommended = await discovery("recommended");
assert(
  !recommended.error && recommended.data?.[0]?.provider_slug === high.providerSlug,
  `recommended ranking ignored verified reputation history: ${JSON.stringify(recommended.data)}`,
);

console.log("Phase 07 reputation metrics and ranking runtime checks: PASS");

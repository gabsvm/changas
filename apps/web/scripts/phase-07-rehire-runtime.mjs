import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase credentials are required for Phase 07 rehire runtime checks.",
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
const compactRunId = runId.replaceAll("-", "");
const password = `Phase07-rehire-${runId}-valid-password`;
const users = {
  client: { email: `phase07-rehire-client-${runId}@example.test` },
  provider: { email: `phase07-rehire-provider-${runId}@example.test` },
  outsider: { email: `phase07-rehire-outsider-${runId}@example.test` },
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
const [client, provider, outsider] = await Promise.all([
  signIn(users.client),
  signIn(users.provider),
  signIn(users.outsider),
]);

const categorySlug = `phase07-rehire-category-${compactRunId}`;
const skillSlug = `phase07-rehire-skill-${compactRunId}`;
const providerSlug = `phase07-rehire-provider-${compactRunId}`;
const serviceSlug = `phase07-rehire-service-${compactRunId}`;

const category = await admin
  .from("categories")
  .insert({
    slug: categorySlug,
    name: `Rehire category ${compactRunId.slice(0, 8)}`,
    description: "Categoría sintética para validar rehire Phase 07.",
    is_active: true,
  })
  .select("id")
  .single();
assert(
  !category.error && category.data?.id,
  `Could not create category: ${category.error?.message ?? "unknown"}`,
);

const skill = await admin
  .from("skills")
  .insert({
    category_id: category.data.id,
    slug: skillSlug,
    name: `Rehire skill ${compactRunId.slice(0, 8)}`,
    description: "Skill sintética para validar rehire Phase 07.",
    is_active: true,
  })
  .select("id")
  .single();
assert(
  !skill.error && skill.data?.id,
  `Could not create skill: ${skill.error?.message ?? "unknown"}`,
);

const providerProfile = await admin.from("provider_profiles").insert({
  user_id: users.provider.id,
  status: "ACTIVE",
  onboarding_step: 4,
  public_slug: providerSlug,
  public_headline: "Proveedor sintético para rehire",
});
assert(
  !providerProfile.error,
  `Could not create provider profile: ${providerProfile.error?.message ?? "unknown"}`,
);

const providerSkill = await admin.from("provider_skills").insert({
  provider_user_id: users.provider.id,
  skill_id: skill.data.id,
  is_featured: true,
});
assert(
  !providerSkill.error,
  `Could not attach provider skill: ${providerSkill.error?.message ?? "unknown"}`,
);

const originalTitle = "Servicio original de rehire";
const originalDescription =
  "Descripción original suficientemente extensa para congelar el primer trabajo.";
const originalPrice = 100000;
const service = await admin
  .from("services")
  .insert({
    provider_user_id: users.provider.id,
    skill_id: skill.data.id,
    public_slug: serviceSlug,
    title: originalTitle,
    description: originalDescription,
    modality: "REMOTE",
    price_model: "FIXED",
    price_amount: originalPrice,
    currency_code: "ARS",
    accepts_offers: false,
    schedule_type: "UNSCHEDULED",
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

async function createPaidJob(suffix) {
  const conversation = await client.rpc("start_service_conversation", {
    target_provider_slug: providerSlug,
    target_service_slug: serviceSlug,
  });
  assert(
    !conversation.error && conversation.data,
    `Conversation ${suffix} failed: ${conversation.error?.message ?? "unknown"}`,
  );
  const proposal = await client.rpc("create_conversation_proposal", {
    target_conversation_id: conversation.data,
    requested_kind: "DIRECT_BOOKING",
    scope_text: null,
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
  return {
    conversationId: conversation.data,
    proposalId: proposal.data,
    jobId: paid.data[0].confirmed_job_id,
  };
}

async function completeJob(jobId) {
  const started = await provider.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: "CONFIRMED",
    requested_status: "IN_PROGRESS",
    transition_reason: null,
  });
  assert(
    !started.error && started.data === "IN_PROGRESS",
    `Could not start job: ${started.error?.message ?? "unknown"}`,
  );
  const requested = await provider.rpc("transition_job_status", {
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
    `Could not complete job: ${completed.error?.message ?? "unknown"}`,
  );
}

const original = await createPaidJob("original");
await completeJob(original.jobId);

const originalJobBefore = await admin
  .from("jobs")
  .select("status, accepted_proposal_version_id")
  .eq("id", original.jobId)
  .single();
assert(
  !originalJobBefore.error && originalJobBefore.data?.status === "COMPLETED",
  "Original job did not reach COMPLETED before rehire.",
);
const originalVersionBefore = await admin
  .from("proposal_versions")
  .select("service_title_snapshot, service_description_snapshot, price_amount")
  .eq("id", originalJobBefore.data.accepted_proposal_version_id)
  .single();
assert(
  !originalVersionBefore.error &&
    originalVersionBefore.data?.service_title_snapshot === originalTitle &&
    originalVersionBefore.data?.price_amount === originalPrice,
  "Original Job did not preserve its original proposal snapshot.",
);

const reviewStateBefore = await client.rpc("get_job_review_state", {
  target_job_id: original.jobId,
});
assert(
  !reviewStateBefore.error &&
    reviewStateBefore.data?.[0]?.can_review === true &&
    reviewStateBefore.data?.[0]?.review_id === null,
  `Completed Job was not review-eligible: ${reviewStateBefore.error?.message ?? "unknown"}`,
);
const outsiderReviewState = await outsider.rpc("get_job_review_state", {
  target_job_id: original.jobId,
});
assert(
  Boolean(outsiderReviewState.error),
  "Outsider can read participant-only Job review state.",
);

const currentTitle = "Servicio actualizado para rehire";
const currentDescription =
  "Descripción actualizada que debe congelarse en la nueva propuesta de contratación.";
const currentPrice = 145000;
const updatedService = await admin
  .from("services")
  .update({
    title: currentTitle,
    description: currentDescription,
    price_amount: currentPrice,
  })
  .eq("id", service.data.id);
assert(
  !updatedService.error,
  `Could not update current service terms: ${updatedService.error?.message ?? "unknown"}`,
);

const providerRehire = await provider.rpc("create_rehire_proposal", {
  target_job_id: original.jobId,
});
assert(
  Boolean(providerRehire.error),
  "Provider can rehire themselves from a Job.",
);
const outsiderRehire = await outsider.rpc("create_rehire_proposal", {
  target_job_id: original.jobId,
});
assert(Boolean(outsiderRehire.error), "Outsider can create a rehire proposal.");

const rehire = await client.rpc("create_rehire_proposal", {
  target_job_id: original.jobId,
});
const rehireRow = rehire.data?.[0];
assert(
  !rehire.error &&
    rehireRow?.proposal_id &&
    rehireRow.proposal_id !== original.proposalId &&
    rehireRow.proposal_kind === "DIRECT_BOOKING" &&
    rehireRow.proposal_status === "AWAITING_PAYMENT",
  `Rehire did not create a fresh direct-booking proposal: ${JSON.stringify(rehire.data)}`,
);

const rehireProposal = await admin
  .from("proposals")
  .select("current_version_id, conversation_id, status")
  .eq("id", rehireRow.proposal_id)
  .single();
assert(
  !rehireProposal.error &&
    rehireProposal.data?.conversation_id === rehireRow.conversation_id &&
    rehireProposal.data?.status === "AWAITING_PAYMENT",
  "Rehire proposal did not persist in the normal proposal flow.",
);
const rehireVersion = await admin
  .from("proposal_versions")
  .select(
    "service_title_snapshot, service_description_snapshot, scope_snapshot, price_amount, price_model_snapshot, schedule_type",
  )
  .eq("id", rehireProposal.data.current_version_id)
  .single();
assert(
  !rehireVersion.error &&
    rehireVersion.data?.service_title_snapshot === currentTitle &&
    rehireVersion.data?.service_description_snapshot === currentDescription &&
    rehireVersion.data?.scope_snapshot === currentDescription &&
    rehireVersion.data?.price_amount === currentPrice &&
    rehireVersion.data?.price_model_snapshot === "FIXED" &&
    rehireVersion.data?.schedule_type === "UNSCHEDULED",
  `Rehire did not snapshot current service terms: ${JSON.stringify(rehireVersion.data)}`,
);

const originalJobAfter = await admin
  .from("jobs")
  .select("status, accepted_proposal_version_id")
  .eq("id", original.jobId)
  .single();
assert(
  !originalJobAfter.error &&
    originalJobAfter.data?.status === "COMPLETED" &&
    originalJobAfter.data?.accepted_proposal_version_id ===
      originalJobBefore.data.accepted_proposal_version_id,
  "Rehire mutated or reopened the historical Job.",
);
const originalVersionAfter = await admin
  .from("proposal_versions")
  .select("service_title_snapshot, service_description_snapshot, price_amount")
  .eq("id", originalJobAfter.data.accepted_proposal_version_id)
  .single();
assert(
  !originalVersionAfter.error &&
    originalVersionAfter.data?.service_title_snapshot ===
      originalVersionBefore.data.service_title_snapshot &&
    originalVersionAfter.data?.service_description_snapshot ===
      originalVersionBefore.data.service_description_snapshot &&
    originalVersionAfter.data?.price_amount ===
      originalVersionBefore.data.price_amount,
  "Rehire changed the immutable historical proposal version.",
);

const review = await client.rpc("create_job_review", {
  target_job_id: original.jobId,
  requested_rating: 5,
  requested_review_text: "Excelente trabajo y volvería a contratar.",
  requested_quality_rating: 5,
  requested_punctuality_rating: 4,
  requested_communication_rating: 5,
});
assert(
  !review.error && review.data,
  `Could not publish rehire fixture review: ${review.error?.message ?? "unknown"}`,
);
const clientReviewState = await client.rpc("get_job_review_state", {
  target_job_id: original.jobId,
});
assert(
  !clientReviewState.error &&
    clientReviewState.data?.[0]?.review_id === review.data &&
    clientReviewState.data?.[0]?.rating === 5 &&
    clientReviewState.data?.[0]?.can_review === false,
  "Client Job review state did not expose the immutable published review.",
);

const reply = await provider.rpc("upsert_provider_review_reply", {
  target_review_id: review.data,
  requested_reply_text: "Gracias por volver a elegir mi trabajo.",
});
assert(
  !reply.error && reply.data,
  `Provider reply failed: ${reply.error?.message ?? "unknown"}`,
);
const providerStateWithReply = await provider.rpc("get_job_review_state", {
  target_job_id: original.jobId,
});
assert(
  !providerStateWithReply.error &&
    providerStateWithReply.data?.[0]?.provider_reply ===
      "Gracias por volver a elegir mi trabajo." &&
    providerStateWithReply.data?.[0]?.reported_by_caller === false,
  "Provider Job review state lost their public reply.",
);
const report = await provider.rpc("report_review", {
  target_review_id: review.data,
  requested_reason: "OTHER",
  requested_details: "Reporte sintético para validar estado privado.",
});
assert(
  !report.error && report.data,
  `Provider review report failed: ${report.error?.message ?? "unknown"}`,
);
const providerStateReported = await provider.rpc("get_job_review_state", {
  target_job_id: original.jobId,
});
assert(
  !providerStateReported.error &&
    providerStateReported.data?.[0]?.reported_by_caller === true,
  "Job review state did not reflect the caller's private report.",
);

const favorited = await client.rpc("set_provider_favorite", {
  target_provider_slug: providerSlug,
  should_favorite: true,
});
assert(
  !favorited.error && favorited.data === true,
  `Could not favorite provider: ${favorited.error?.message ?? "unknown"}`,
);
const favorites = await client.rpc("list_my_favorite_providers_v2");
const favorite = favorites.data?.find(
  (row) => row.provider_slug === providerSlug,
);
assert(
  !favorites.error &&
    favorite?.rating_average === 5 &&
    favorite?.review_count === 1 &&
    favorite?.completed_jobs === 1 &&
    favorite?.completion_rate === 1 &&
    favorite?.repeat_client_count === 0,
  `Favorite reputation metrics are wrong: ${JSON.stringify(favorite)}`,
);

const otherServiceSlug = `phase07-rehire-noncompleted-${compactRunId}`;
const otherService = await admin
  .from("services")
  .insert({
    provider_user_id: users.provider.id,
    skill_id: skill.data.id,
    public_slug: otherServiceSlug,
    title: "Servicio no completado",
    description:
      "Servicio independiente para verificar que un Job confirmado no pueda originar rehire.",
    modality: "REMOTE",
    price_model: "FIXED",
    price_amount: 90000,
    currency_code: "ARS",
    accepts_offers: false,
    schedule_type: "UNSCHEDULED",
    is_published: true,
    is_paused: false,
  })
  .select("id")
  .single();
assert(
  !otherService.error && otherService.data?.id,
  "Could not create second service.",
);
const secondConversation = await client.rpc("start_service_conversation", {
  target_provider_slug: providerSlug,
  target_service_slug: otherServiceSlug,
});
const secondProposal = await client.rpc("create_conversation_proposal", {
  target_conversation_id: secondConversation.data,
  requested_kind: "DIRECT_BOOKING",
  scope_text: null,
  proposed_price_amount: null,
  proposed_schedule_start_at: null,
  proposed_schedule_end_at: null,
  proposed_deadline_at: null,
  proposal_expires_at: null,
});
const secondPaid = await admin.rpc("apply_fake_payment_result", {
  target_proposal_id: secondProposal.data,
  payment_nonce: crypto.randomUUID(),
  payment_outcome: "SUCCESS",
  actor_client_user_id: users.client.id,
});
const confirmedJobId = secondPaid.data?.[0]?.confirmed_job_id;
assert(
  !secondConversation.error &&
    !secondProposal.error &&
    !secondPaid.error &&
    confirmedJobId,
  "Could not create non-completed rehire fixture.",
);
const prematureRehire = await client.rpc("create_rehire_proposal", {
  target_job_id: confirmedJobId,
});
assert(Boolean(prematureRehire.error), "A non-completed Job can be rehired.");

const paused = await admin
  .from("services")
  .update({ is_paused: true })
  .eq("id", service.data.id);
assert(!paused.error, "Could not pause current service for rehire guard.");
const unavailableRehire = await client.rpc("create_rehire_proposal", {
  target_job_id: original.jobId,
});
assert(
  Boolean(unavailableRehire.error),
  "A paused current service can still create a rehire proposal.",
);

console.log("Phase 07 rehire and account reputation runtime checks: PASS");

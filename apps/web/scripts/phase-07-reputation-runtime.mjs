import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase credentials are required for Phase 07 runtime checks.",
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
const password = `Phase07-${runId}-valid-password`;
const users = {
  client: { email: `phase07-client-${runId}@example.test` },
  provider: { email: `phase07-provider-${runId}@example.test` },
  outsider: { email: `phase07-outsider-${runId}@example.test` },
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

const skill = await admin
  .from("skills")
  .select("id")
  .eq("slug", "reparacion-pc")
  .single();
assert(!skill.error && skill.data?.id, "Phase 07 skill fixture is missing.");

const providerSlug = `phase07-provider-${runId}`;
const serviceSlug = `phase07-service-${runId}`;
assert(
  !(
    await admin.from("provider_profiles").insert({
      user_id: users.provider.id,
      status: "ACTIVE",
      onboarding_step: 4,
      public_slug: providerSlug,
      public_headline: "Phase 07 reputation provider",
    })
  ).error,
  "Could not create Phase 07 provider profile.",
);
assert(
  !(
    await admin.from("provider_skills").insert({
      provider_user_id: users.provider.id,
      skill_id: skill.data.id,
      is_featured: true,
    })
  ).error,
  "Could not attach Phase 07 provider skill.",
);
const service = await admin
  .from("services")
  .insert({
    provider_user_id: users.provider.id,
    skill_id: skill.data.id,
    public_slug: serviceSlug,
    title: "Revisión verificada Phase 07",
    description:
      "Servicio sintético para verificar autoridad, contexto e inmutabilidad de reseñas.",
    modality: "REMOTE",
    price_model: "FIXED",
    price_amount: 120000,
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
  `Could not create Phase 07 service: ${service.error?.message ?? "unknown"}`,
);

async function createPaidJob(suffix) {
  const started = await client.rpc("start_service_conversation", {
    target_provider_slug: providerSlug,
    target_service_slug: serviceSlug,
  });
  assert(
    !started.error && started.data,
    `Conversation ${suffix} failed: ${started.error?.message ?? "unknown"}`,
  );
  const proposal = await client.rpc("create_conversation_proposal", {
    target_conversation_id: started.data,
    requested_kind: "DIRECT_BOOKING",
    scope_text: `Trabajo Phase 07 ${suffix}`,
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

async function completeJob(jobId) {
  const started = await provider.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: "CONFIRMED",
    requested_status: "IN_PROGRESS",
    transition_reason: null,
  });
  assert(
    !started.error && started.data === "IN_PROGRESS",
    `Provider could not start Job: ${started.error?.message ?? "unknown"}`,
  );
  const requested = await provider.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: "IN_PROGRESS",
    requested_status: "COMPLETION_REQUESTED",
    transition_reason: null,
  });
  assert(
    !requested.error && requested.data === "COMPLETION_REQUESTED",
    `Provider could not request completion: ${requested.error?.message ?? "unknown"}`,
  );
  const completed = await client.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: "COMPLETION_REQUESTED",
    requested_status: "COMPLETED",
    transition_reason: null,
  });
  assert(
    !completed.error && completed.data === "COMPLETED",
    `Client could not complete Job: ${completed.error?.message ?? "unknown"}`,
  );
}

const activeJobId = await createPaidJob("active");
const completedJobId = await createPaidJob("completed");
await completeJob(completedJobId);

const activeReview = await client.rpc("create_job_review", {
  target_job_id: activeJobId,
  requested_rating: 5,
  requested_review_text: "Todavía no debería poder publicarse.",
  requested_quality_rating: 5,
  requested_punctuality_rating: null,
  requested_communication_rating: 5,
});
assert(Boolean(activeReview.error), "An active Job accepted a public review.");

const invalidRating = await client.rpc("create_job_review", {
  target_job_id: completedJobId,
  requested_rating: 6,
  requested_review_text: null,
  requested_quality_rating: null,
  requested_punctuality_rating: null,
  requested_communication_rating: null,
});
assert(Boolean(invalidRating.error), "A rating outside 1-5 was accepted.");

const providerReview = await provider.rpc("create_job_review", {
  target_job_id: completedJobId,
  requested_rating: 5,
  requested_review_text: "Autoreseña inválida",
  requested_quality_rating: null,
  requested_punctuality_rating: null,
  requested_communication_rating: null,
});
assert(Boolean(providerReview.error), "Provider could review their own Job.");

const outsiderReview = await outsider.rpc("create_job_review", {
  target_job_id: completedJobId,
  requested_rating: 5,
  requested_review_text: "Reseña sin relación contractual",
  requested_quality_rating: null,
  requested_punctuality_rating: null,
  requested_communication_rating: null,
});
assert(Boolean(outsiderReview.error), "Outsider could review a private Job.");

const createdReview = await client.rpc("create_job_review", {
  target_job_id: completedJobId,
  requested_rating: 4,
  requested_review_text: "Buen trabajo, contexto contractual verificado.",
  requested_quality_rating: 5,
  requested_punctuality_rating: 4,
  requested_communication_rating: 4,
});
assert(
  !createdReview.error && createdReview.data,
  `Verified review creation failed: ${createdReview.error?.message ?? "unknown"}`,
);
const reviewId = createdReview.data;

const duplicateReview = await client.rpc("create_job_review", {
  target_job_id: completedJobId,
  requested_rating: 3,
  requested_review_text: "No debe existir una segunda reseña.",
  requested_quality_rating: null,
  requested_punctuality_rating: null,
  requested_communication_rating: null,
});
assert(Boolean(duplicateReview.error), "A Job accepted a duplicate review.");

const persistedReview = await client
  .from("reviews")
  .select(
    "id,job_id,service_id,skill_id,category_id,rating,quality_rating,punctuality_rating,communication_rating,service_title_snapshot,skill_name_snapshot,category_name_snapshot",
  )
  .eq("id", reviewId)
  .single();
assert(
  !persistedReview.error &&
    persistedReview.data?.job_id === completedJobId &&
    persistedReview.data?.service_id === service.data.id &&
    persistedReview.data?.skill_id === skill.data.id &&
    persistedReview.data?.rating === 4 &&
    persistedReview.data?.quality_rating === 5,
  "Verified review lost its Job/Service/Skill context or rating dimensions.",
);

const providerMutation = await provider
  .from("reviews")
  .update({ rating: 5 })
  .eq("id", reviewId);
assert(
  Boolean(providerMutation.error),
  "Provider directly changed a client review.",
);
const providerDelete = await provider
  .from("reviews")
  .delete()
  .eq("id", reviewId);
assert(
  Boolean(providerDelete.error),
  "Provider directly deleted a client review.",
);

const firstReply = await provider.rpc("upsert_provider_review_reply", {
  target_review_id: reviewId,
  requested_reply_text: "Gracias por confiar en mi trabajo.",
});
assert(
  !firstReply.error && firstReply.data,
  `Provider reply failed: ${firstReply.error?.message ?? "unknown"}`,
);
const secondReply = await provider.rpc("upsert_provider_review_reply", {
  target_review_id: reviewId,
  requested_reply_text: "Gracias por confiar en mi trabajo. Respuesta editada.",
});
assert(
  !secondReply.error && secondReply.data === firstReply.data,
  "Provider reply edit created a second public reply.",
);
const replyRows = await admin
  .from("review_replies")
  .select("id,reply_text")
  .eq("review_id", reviewId);
assert(
  !replyRows.error &&
    replyRows.data?.length === 1 &&
    replyRows.data[0].reply_text.includes("editada"),
  "Review has more than one provider reply or the edit was not persisted.",
);
const outsiderReply = await outsider.rpc("upsert_provider_review_reply", {
  target_review_id: reviewId,
  requested_reply_text: "No soy el proveedor.",
});
assert(Boolean(outsiderReply.error), "Outsider could reply as the provider.");

const authorReport = await client.rpc("report_review", {
  target_review_id: reviewId,
  requested_reason: "OTHER",
  requested_details: "No debo reportar mi propia reseña.",
});
assert(
  Boolean(authorReport.error),
  "Review author could report their own review.",
);

const outsiderReport = await outsider.rpc("report_review", {
  target_review_id: reviewId,
  requested_reason: "IRRELEVANT_CONTENT",
  requested_details: "Reporte sintético de Phase 07.",
});
assert(
  !outsiderReport.error && outsiderReport.data,
  `Authenticated report failed: ${outsiderReport.error?.message ?? "unknown"}`,
);
const repeatedReport = await outsider.rpc("report_review", {
  target_review_id: reviewId,
  requested_reason: "ABUSE",
  requested_details: "Segundo intento que debe ser idempotente.",
});
assert(
  !repeatedReport.error && repeatedReport.data === outsiderReport.data,
  "Repeated review report was not idempotent per reporter.",
);

const outsiderOwnReports = await outsider
  .from("review_reports")
  .select("id,reason")
  .eq("review_id", reviewId);
assert(
  !outsiderOwnReports.error && outsiderOwnReports.data?.length === 1,
  "Reporter cannot inspect their own private report or duplicate reports exist.",
);
const providerReports = await provider
  .from("review_reports")
  .select("id")
  .eq("review_id", reviewId);
assert(
  !providerReports.error && providerReports.data?.length === 0,
  "A different authenticated user can inspect someone else's report metadata.",
);

const anonymous = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
const anonymousReports = await anonymous.from("review_reports").select("id");
assert(
  Boolean(anonymousReports.error),
  "Anonymous user can query review reports.",
);

console.log("Phase 07 verified review runtime authority checks: PASS");

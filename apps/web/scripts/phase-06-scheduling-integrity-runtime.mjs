import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase credentials are required for Phase 06 scheduling integrity checks.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = crypto.randomUUID();
const password = `Phase06-integrity-${runId}-Password1!`;
const users = {
  clientA: { email: `phase06-integrity-a-${runId}@example.test` },
  clientB: { email: `phase06-integrity-b-${runId}@example.test` },
  provider: { email: `phase06-integrity-provider-${runId}@example.test` },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createUser(user) {
  const created = await admin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
  });
  assert(
    !created.error && created.data.user,
    `Could not create integrity user: ${created.error?.message ?? "unknown"}`,
  );
  user.id = created.data.user.id;

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await client.auth.signInWithPassword({
    email: user.email,
    password,
  });
  assert(
    !signedIn.error,
    `Could not sign in integrity user: ${signedIn.error?.message ?? "unknown"}`,
  );
  return client;
}

const [clientA, clientB, provider] = await Promise.all([
  createUser(users.clientA),
  createUser(users.clientB),
  createUser(users.provider),
]);

const skill = await admin
  .from("skills")
  .select("id")
  .eq("slug", "reparacion-pc")
  .single();
assert(!skill.error && skill.data?.id, "Scheduling integrity skill is missing.");

const providerSlug = `phase06-integrity-provider-${runId}`;
const serviceSlug = `phase06-integrity-service-${runId}`;
assert(
  !(
    await admin.from("provider_profiles").insert({
      user_id: users.provider.id,
      status: "ACTIVE",
      onboarding_step: 4,
      public_slug: providerSlug,
    })
  ).error,
  "Could not create integrity provider.",
);
assert(
  !(
    await admin.from("provider_skills").insert({
      provider_user_id: users.provider.id,
      skill_id: skill.data.id,
      is_featured: true,
    })
  ).error,
  "Could not attach integrity provider skill.",
);
const service = await admin
  .from("services")
  .insert({
    provider_user_id: users.provider.id,
    skill_id: skill.data.id,
    public_slug: serviceSlug,
    title: "Agenda transaccional Phase 06",
    description:
      "Servicio sintético para demostrar revalidación transaccional de agenda al confirmar y reprogramar.",
    modality: "IN_PERSON",
    price_model: "FIXED",
    price_amount: 210000,
    currency_code: "ARS",
    schedule_type: "FIXED_SLOT",
    expected_duration_minutes: 30,
    is_published: true,
    is_paused: false,
  })
  .select("id")
  .single();
assert(
  !service.error && service.data?.id,
  `Could not create integrity service: ${service.error?.message ?? "unknown"}`,
);

const rule = await provider.rpc("upsert_provider_availability_rule", {
  target_rule_id: null,
  requested_weekday: 1,
  requested_start_time: "14:00:00",
  requested_end_time: "18:00:00",
  requested_timezone: "UTC",
  requested_is_active: true,
});
assert(!rule.error, `Could not create integrity rule: ${rule.error?.message}`);

async function createProposal(client, label, startsAt, endsAt) {
  const conversation = await client.rpc("start_service_conversation", {
    target_provider_slug: providerSlug,
    target_service_slug: serviceSlug,
  });
  assert(
    !conversation.error && conversation.data,
    `Conversation ${label} failed: ${conversation.error?.message ?? "unknown"}`,
  );
  const proposal = await client.rpc("create_conversation_proposal", {
    target_conversation_id: conversation.data,
    requested_kind: "DIRECT_BOOKING",
    scope_text: `Transactional scheduling ${label}`,
    proposed_price_amount: null,
    proposed_schedule_start_at: startsAt,
    proposed_schedule_end_at: endsAt,
    proposed_deadline_at: null,
    proposal_expires_at: null,
  });
  assert(
    !proposal.error && proposal.data,
    `Proposal ${label} failed: ${proposal.error?.message ?? "unknown"}`,
  );
  return proposal.data;
}

async function payProposal(proposalId, clientUserId, label) {
  return admin.rpc("apply_payment_result", {
    target_proposal_id: proposalId,
    payment_nonce: crypto.randomUUID(),
    payment_provider_name: "RUNTIME",
    payment_provider_reference: `phase06-integrity-${label}-${crypto.randomUUID()}`,
    payment_result_status: "SUCCEEDED",
    actor_client_user_id: clientUserId,
  });
}

const violations = [];

const holdProposal = await createProposal(
  clientA,
  "active-hold-owner",
  "2026-09-07T14:00:00.000Z",
  "2026-09-07T14:30:00.000Z",
);
const holdNonce = crypto.randomUUID();
const activeHold = await clientA.rpc("hold_proposal_slot", {
  target_proposal_id: holdProposal,
  hold_nonce: holdNonce,
  ttl_seconds: 600,
});
assert(
  !activeHold.error && activeHold.data,
  `Could not create integrity hold: ${activeHold.error?.message ?? "unknown"}`,
);

const competingProposal = await createProposal(
  clientB,
  "active-hold-competitor",
  "2026-09-07T14:00:00.000Z",
  "2026-09-07T14:30:00.000Z",
);
const competingPayment = await payProposal(
  competingProposal,
  users.clientB.id,
  "active-hold-competitor",
);
if (!competingPayment.error) {
  violations.push("Job confirmation ignored another client's active slot hold");
}

const blocked = await provider.rpc("create_provider_availability_block", {
  requested_starts_at: "2026-09-07T15:00:00.000Z",
  requested_ends_at: "2026-09-07T15:30:00.000Z",
  requested_reason: "Blocked before payment",
});
assert(!blocked.error, `Could not create integrity block: ${blocked.error?.message}`);

const blockedProposal = await createProposal(
  clientA,
  "blocked-payment",
  "2026-09-07T15:00:00.000Z",
  "2026-09-07T15:30:00.000Z",
);
const blockedPayment = await payProposal(
  blockedProposal,
  users.clientA.id,
  "blocked-payment",
);
if (!blockedPayment.error) {
  violations.push("Job confirmation ignored an availability exception block");
}

const outsideRuleProposal = await createProposal(
  clientA,
  "outside-rule-payment",
  "2026-09-07T18:00:00.000Z",
  "2026-09-07T18:30:00.000Z",
);
const outsideRulePayment = await payProposal(
  outsideRuleProposal,
  users.clientA.id,
  "outside-rule-payment",
);
if (!outsideRulePayment.error) {
  violations.push("Job confirmation ignored recurring availability rules");
}

const validProposal = await createProposal(
  clientA,
  "valid-job",
  "2026-09-07T16:00:00.000Z",
  "2026-09-07T16:30:00.000Z",
);
const validPayment = await payProposal(
  validProposal,
  users.clientA.id,
  "valid-job",
);
const validJobId = validPayment.data?.[0]?.confirmed_job_id;
assert(
  !validPayment.error && validJobId,
  `Available slot could not become a Job: ${validPayment.error?.message ?? "unknown"}`,
);

const rescheduleBlock = await provider.rpc(
  "create_provider_availability_block",
  {
    requested_starts_at: "2026-09-07T17:00:00.000Z",
    requested_ends_at: "2026-09-07T17:30:00.000Z",
    requested_reason: "Blocked before reschedule acceptance",
  },
);
assert(
  !rescheduleBlock.error,
  `Could not create reschedule block: ${rescheduleBlock.error?.message}`,
);

const reschedule = await clientA.rpc("request_job_reschedule", {
  target_job_id: validJobId,
  requested_schedule_type: "FIXED_SLOT",
  requested_starts_at: "2026-09-07T17:00:00.000Z",
  requested_ends_at: "2026-09-07T17:30:00.000Z",
  requested_deadline_at: null,
  requested_duration_minutes: 30,
  request_reason: "Transactional revalidation test",
});
assert(
  !reschedule.error && reschedule.data,
  `Could not request reschedule: ${reschedule.error?.message ?? "unknown"}`,
);
const acceptedBlockedReschedule = await provider.rpc("respond_job_reschedule", {
  target_request_id: reschedule.data,
  response_action: "ACCEPT",
});
if (!acceptedBlockedReschedule.error) {
  violations.push("Reschedule acceptance ignored an availability exception block");
}

assert(
  violations.length === 0,
  `Transactional scheduling revalidation failed: ${violations.join("; ")}`,
);

console.log("Phase 06 transactional scheduling integrity checks: PASS");

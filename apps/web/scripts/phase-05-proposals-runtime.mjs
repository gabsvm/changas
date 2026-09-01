import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase API_URL, ANON_KEY, and SERVICE_ROLE_KEY are required.",
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
const password = `Phase05-${runId}-valid-password`;
const users = {
  client: { email: `phase05-client-${runId}@example.test`, id: undefined },
  provider: { email: `phase05-provider-${runId}@example.test`, id: undefined },
  outsider: { email: `phase05-outsider-${runId}@example.test`, id: undefined },
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
    `Could not create Phase 05 user: ${error?.message ?? "unknown"}`,
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

const skill = await admin
  .from("skills")
  .select("id")
  .eq("slug", "reparacion-pc")
  .single();
assert(
  !skill.error && skill.data?.id,
  "Phase 05 runtime skill fixture is missing.",
);

const providerSlug = `phase05-provider-${runId}`;
const serviceSlug = `phase05-service-${runId}`;

const providerProfile = await admin.from("provider_profiles").insert({
  user_id: users.provider.id,
  status: "ACTIVE",
  onboarding_step: 4,
  public_slug: providerSlug,
  public_headline: "Phase 05 runtime provider",
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

const service = await admin
  .from("services")
  .insert({
    provider_user_id: users.provider.id,
    skill_id: skill.data.id,
    public_slug: serviceSlug,
    title: "Diagnóstico Phase 05",
    description:
      "Servicio sintético de precio fijo para validar propuestas, pagos falsos e idempotencia.",
    modality: "REMOTE",
    price_model: "FIXED",
    price_amount: 125000,
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
  `Could not create Phase 05 service: ${service.error?.message ?? "unknown"}`,
);

const client = await signIn(users.client);
const provider = await signIn(users.provider);
const outsider = await signIn(users.outsider);

const started = await client.rpc("start_service_conversation", {
  target_provider_slug: providerSlug,
  target_service_slug: serviceSlug,
});
assert(
  !started.error && started.data,
  `Could not start Phase 05 conversation: ${started.error?.message ?? "unknown"}`,
);
const conversationId = started.data;

const outsiderList = await outsider.rpc("list_conversation_proposals", {
  target_conversation_id: conversationId,
});
assert(
  Boolean(outsiderList.error),
  "Outsider can list proposals from another conversation.",
);

const forbiddenProviderBooking = await provider.rpc(
  "create_conversation_proposal",
  {
    target_conversation_id: conversationId,
    requested_kind: "DIRECT_BOOKING",
    scope_text: "Reserva que el proveedor no debe poder crear",
    proposed_price_amount: null,
    proposed_schedule_start_at: null,
    proposed_schedule_end_at: null,
    proposed_deadline_at: null,
    proposal_expires_at: null,
  },
);
assert(
  Boolean(forbiddenProviderBooking.error),
  "Provider can create a client-only direct booking.",
);

const clientOffer = await client.rpc("create_conversation_proposal", {
  target_conversation_id: conversationId,
  requested_kind: "CLIENT_OFFER",
  scope_text: "Oferta del cliente que el proveedor puede aceptar",
  proposed_price_amount: 99000,
  proposed_schedule_start_at: null,
  proposed_schedule_end_at: null,
  proposed_deadline_at: null,
  proposal_expires_at: null,
});
assert(
  !clientOffer.error && clientOffer.data,
  `Client offer failed: ${clientOffer.error?.message ?? "unknown"}`,
);

const providerAcceptedOffer = await provider.rpc("respond_to_proposal", {
  target_proposal_id: clientOffer.data,
  response_action: "ACCEPT",
});
assert(
  !providerAcceptedOffer.error &&
    providerAcceptedOffer.data === "AWAITING_PAYMENT",
  `Provider could not accept client-authored terms: ${providerAcceptedOffer.error?.message ?? providerAcceptedOffer.data ?? "unknown"}`,
);

const expiringOffer = await client.rpc("create_conversation_proposal", {
  target_conversation_id: conversationId,
  requested_kind: "CLIENT_OFFER",
  scope_text: "Oferta destinada a validar expiración persistente",
  proposed_price_amount: 100000,
  proposed_schedule_start_at: null,
  proposed_schedule_end_at: null,
  proposed_deadline_at: null,
  proposal_expires_at: new Date(Date.now() + 60_000).toISOString(),
});
assert(
  !expiringOffer.error && expiringOffer.data,
  `Expiring client offer failed: ${expiringOffer.error?.message ?? "unknown"}`,
);

const forcedPastExpiry = await admin
  .from("proposals")
  .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
  .eq("id", expiringOffer.data);
assert(
  !forcedPastExpiry.error,
  `Could not force proposal expiry: ${forcedPastExpiry.error?.message ?? "unknown"}`,
);

const expiredRevision = await client.rpc("revise_conversation_proposal", {
  target_proposal_id: expiringOffer.data,
  requested_kind: "CLIENT_OFFER",
  scope_text: "Esta revisión no debe reabrir una propuesta vencida",
  proposed_price_amount: 101000,
  proposed_schedule_start_at: null,
  proposed_schedule_end_at: null,
  proposed_deadline_at: null,
  proposal_expires_at: null,
});
assert(
  !expiredRevision.error && expiredRevision.data === null,
  `Expired proposal revision must persist EXPIRED without rolling back: ${expiredRevision.error?.message ?? expiredRevision.data ?? "unknown"}`,
);

const expiredProposal = await admin
  .from("proposals")
  .select("status")
  .eq("id", expiringOffer.data)
  .single();
assert(
  !expiredProposal.error && expiredProposal.data?.status === "EXPIRED",
  `Expired proposal status was not persisted: ${expiredProposal.error?.message ?? expiredProposal.data?.status ?? "unknown"}`,
);

const booking = await client.rpc("create_conversation_proposal", {
  target_conversation_id: conversationId,
  requested_kind: "DIRECT_BOOKING",
  scope_text: "Diagnóstico remoto con precio publicado",
  proposed_price_amount: null,
  proposed_schedule_start_at: null,
  proposed_schedule_end_at: null,
  proposed_deadline_at: null,
  proposal_expires_at: null,
});
assert(
  !booking.error && booking.data,
  `Client direct booking failed: ${booking.error?.message ?? "unknown"}`,
);
const proposalId = booking.data;

const clientList = await client.rpc("list_conversation_proposals", {
  target_conversation_id: conversationId,
});
assert(
  !clientList.error && clientList.data?.length === 3,
  "Client cannot read all created proposals.",
);
const proposalRow = clientList.data.find(
  (proposal) => proposal.proposal_id === proposalId,
);
assert(proposalRow, "Direct booking is missing from proposal list.");
assert(
  proposalRow.proposal_status === "AWAITING_PAYMENT",
  `Direct booking status should be AWAITING_PAYMENT, got ${proposalRow.proposal_status}.`,
);
assert(
  proposalRow.price_amount === 125000,
  "Direct booking did not snapshot the published fixed price.",
);

const paymentNonce = crypto.randomUUID();
const paidOnce = await admin.rpc("apply_fake_payment_result", {
  target_proposal_id: proposalId,
  payment_nonce: paymentNonce,
  payment_outcome: "SUCCESS",
  actor_client_user_id: users.client.id,
});
assert(
  !paidOnce.error && paidOnce.data?.length === 1,
  `Fake payment success failed: ${paidOnce.error?.message ?? "unknown"}`,
);
const firstPayment = paidOnce.data[0];
assert(
  firstPayment.resulting_proposal_status === "PAID" &&
    firstPayment.payment_attempt_id &&
    firstPayment.confirmed_job_id,
  "Successful fake payment did not produce PAID proposal + confirmed job.",
);

const paidTwice = await admin.rpc("apply_fake_payment_result", {
  target_proposal_id: proposalId,
  payment_nonce: paymentNonce,
  payment_outcome: "SUCCESS",
  actor_client_user_id: users.client.id,
});
assert(
  !paidTwice.error && paidTwice.data?.length === 1,
  `Idempotent fake payment retry failed: ${paidTwice.error?.message ?? "unknown"}`,
);
const secondPayment = paidTwice.data[0];
assert(
  secondPayment.payment_attempt_id === firstPayment.payment_attempt_id,
  "Duplicate fake payment nonce created a second payment attempt.",
);
assert(
  secondPayment.confirmed_job_id === firstPayment.confirmed_job_id,
  "Duplicate fake payment nonce created a second job.",
);

const jobs = await admin
  .from("jobs")
  .select("id,accepted_proposal_version_id,payment_attempt_id,status")
  .eq("conversation_id", conversationId);
assert(!jobs.error, `Could not inspect Phase 05 jobs: ${jobs.error?.message}`);
assert(
  jobs.data?.length === 1,
  "Successful payment produced more than one job.",
);
assert(
  jobs.data[0].id === firstPayment.confirmed_job_id &&
    jobs.data[0].status === "CONFIRMED",
  "Confirmed job does not match the fake payment result.",
);

const immutableUpdate = await admin
  .from("proposal_versions")
  .update({ scope_snapshot: "Mutación que debe ser rechazada" })
  .eq("id", jobs.data[0].accepted_proposal_version_id);
assert(
  Boolean(immutableUpdate.error),
  "Accepted proposal version can be mutated after payment.",
);

const providerList = await provider.rpc("list_conversation_proposals", {
  target_conversation_id: conversationId,
});
const providerPaidProposal = providerList.data?.find(
  (proposal) => proposal.proposal_id === proposalId,
);
assert(
  !providerList.error && providerPaidProposal?.proposal_status === "PAID",
  "Provider cannot observe the final PAID proposal state.",
);

console.log("Phase 05 proposal/payment runtime security checks: PASS");

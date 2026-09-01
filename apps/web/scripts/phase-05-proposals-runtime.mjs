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
const originalServiceTitle = "Diagnóstico Phase 05";
const originalServiceDescription =
  "Servicio sintético de precio fijo para validar propuestas, pagos falsos e idempotencia.";
const originalServicePrice = 125000;

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
    title: originalServiceTitle,
    description: originalServiceDescription,
    modality: "REMOTE",
    price_model: "FIXED",
    price_amount: originalServicePrice,
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

async function createDirectBooking(scopeText) {
  const result = await client.rpc("create_conversation_proposal", {
    target_conversation_id: conversationId,
    requested_kind: "DIRECT_BOOKING",
    scope_text: scopeText,
    proposed_price_amount: null,
    proposed_schedule_start_at: null,
    proposed_schedule_end_at: null,
    proposed_deadline_at: null,
    proposal_expires_at: null,
  });
  assert(
    !result.error && result.data,
    `Direct booking failed: ${result.error?.message ?? "unknown"}`,
  );
  return result.data;
}

async function applyFakePayment(proposalId, paymentNonce, paymentOutcome) {
  const result = await admin.rpc("apply_fake_payment_result", {
    target_proposal_id: proposalId,
    payment_nonce: paymentNonce,
    payment_outcome: paymentOutcome,
    actor_client_user_id: users.client.id,
  });
  assert(
    !result.error && result.data?.length === 1,
    `Fake payment ${paymentOutcome} failed: ${result.error?.message ?? "unknown"}`,
  );
  return result.data[0];
}

async function getProposal(proposalId) {
  const result = await client.rpc("list_conversation_proposals", {
    target_conversation_id: conversationId,
  });
  assert(
    !result.error,
    `Could not list Phase 05 proposals: ${result.error?.message ?? "unknown"}`,
  );
  const row = result.data?.find(
    (proposal) => proposal.proposal_id === proposalId,
  );
  assert(row, `Proposal ${proposalId} is missing from the conversation list.`);
  return row;
}

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

const providerQuote = await provider.rpc("create_conversation_proposal", {
  target_conversation_id: conversationId,
  requested_kind: "PROVIDER_QUOTE",
  scope_text: "Cotización que sólo el cliente puede aceptar",
  proposed_price_amount: 108000,
  proposed_schedule_start_at: null,
  proposed_schedule_end_at: null,
  proposed_deadline_at: null,
  proposal_expires_at: null,
});
assert(
  !providerQuote.error && providerQuote.data,
  `Provider quote failed: ${providerQuote.error?.message ?? "unknown"}`,
);
const providerSelfAccept = await provider.rpc("respond_to_proposal", {
  target_proposal_id: providerQuote.data,
  response_action: "ACCEPT",
});
assert(
  Boolean(providerSelfAccept.error),
  "Provider can accept provider-authored terms on behalf of the client.",
);
const clientRejectedQuote = await client.rpc("respond_to_proposal", {
  target_proposal_id: providerQuote.data,
  response_action: "REJECT",
});
assert(
  !clientRejectedQuote.error && clientRejectedQuote.data === "REJECTED",
  `Client could not reject provider quote: ${clientRejectedQuote.error?.message ?? "unknown"}`,
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

const outsiderAccept = await outsider.rpc("respond_to_proposal", {
  target_proposal_id: clientOffer.data,
  response_action: "ACCEPT",
});
assert(
  Boolean(outsiderAccept.error),
  "Outsider can accept a proposal they do not participate in.",
);

const [providerAcceptedOfferA, providerAcceptedOfferB] = await Promise.all([
  provider.rpc("respond_to_proposal", {
    target_proposal_id: clientOffer.data,
    response_action: "ACCEPT",
  }),
  provider.rpc("respond_to_proposal", {
    target_proposal_id: clientOffer.data,
    response_action: "ACCEPT",
  }),
]);
for (const accepted of [providerAcceptedOfferA, providerAcceptedOfferB]) {
  assert(
    !accepted.error && accepted.data === "AWAITING_PAYMENT",
    `Concurrent acceptance was not idempotent: ${accepted.error?.message ?? accepted.data ?? "unknown"}`,
  );
}
const acceptanceEvents = await admin
  .from("proposal_events")
  .select("id")
  .eq("proposal_id", clientOffer.data)
  .eq("event_type", "PROPOSAL_ACCEPTED");
assert(
  !acceptanceEvents.error && acceptanceEvents.data?.length === 1,
  "Concurrent acceptance produced duplicate PROPOSAL_ACCEPTED events.",
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

const proposalId = await createDirectBooking(
  "Diagnóstico remoto con precio publicado",
);
const proposalRow = await getProposal(proposalId);
assert(
  proposalRow.proposal_status === "AWAITING_PAYMENT",
  `Direct booking status should be AWAITING_PAYMENT, got ${proposalRow.proposal_status}.`,
);
assert(
  proposalRow.price_amount === originalServicePrice,
  "Direct booking did not snapshot the published fixed price.",
);

const paymentNonce = crypto.randomUUID();
const firstPayment = await applyFakePayment(
  proposalId,
  paymentNonce,
  "SUCCESS",
);
assert(
  firstPayment.resulting_proposal_status === "PAID" &&
    firstPayment.payment_attempt_id &&
    firstPayment.confirmed_job_id,
  "Successful fake payment did not produce PAID proposal + confirmed job.",
);

const secondPayment = await applyFakePayment(
  proposalId,
  paymentNonce,
  "SUCCESS",
);
assert(
  secondPayment.payment_attempt_id === firstPayment.payment_attempt_id,
  "Duplicate fake payment nonce created a second payment attempt.",
);
assert(
  secondPayment.confirmed_job_id === firstPayment.confirmed_job_id,
  "Duplicate fake payment nonce created a second job.",
);

const paidProposal = await getProposal(proposalId);
assert(
  paidProposal.accepted_version_id,
  "Paid direct booking has no immutable accepted proposal version.",
);

const editedService = await admin
  .from("services")
  .update({
    title: "Diagnóstico Phase 05 editado",
    description:
      "Servicio editado después de aceptar y pagar para comprobar que el contrato no cambia retroactivamente.",
    price_amount: 999999,
  })
  .eq("id", service.data.id);
assert(
  !editedService.error,
  `Could not edit source service after payment: ${editedService.error?.message ?? "unknown"}`,
);

const acceptedSnapshot = await admin
  .from("proposal_versions")
  .select(
    "service_title_snapshot,service_description_snapshot,scope_snapshot,price_amount",
  )
  .eq("id", paidProposal.accepted_version_id)
  .single();
assert(
  !acceptedSnapshot.error &&
    acceptedSnapshot.data?.service_title_snapshot === originalServiceTitle &&
    acceptedSnapshot.data?.service_description_snapshot ===
      originalServiceDescription &&
    acceptedSnapshot.data?.scope_snapshot ===
      "Diagnóstico remoto con precio publicado" &&
    acceptedSnapshot.data?.price_amount === originalServicePrice,
  "Editing the source service changed the accepted economic snapshot.",
);

const proposalAfterServiceEdit = await getProposal(proposalId);
assert(
  proposalAfterServiceEdit.service_title === originalServiceTitle &&
    proposalAfterServiceEdit.price_amount === originalServicePrice,
  "Conversation proposal card no longer reads the immutable accepted snapshot after service edit.",
);

const immutableUpdate = await admin
  .from("proposal_versions")
  .update({ scope_snapshot: "Mutación que debe ser rechazada" })
  .eq("id", paidProposal.accepted_version_id);
assert(
  Boolean(immutableUpdate.error),
  "Accepted proposal version can be mutated after payment.",
);

const pendingProposalId = await createDirectBooking(
  "Reserva para validar resultado de pago pendiente",
);
const pendingProposal = await getProposal(pendingProposalId);
const pendingNonce = crypto.randomUUID();
const pendingPayment = await applyFakePayment(
  pendingProposalId,
  pendingNonce,
  "PENDING",
);
assert(
  pendingPayment.resulting_proposal_status === "AWAITING_PAYMENT" &&
    pendingPayment.payment_attempt_id &&
    pendingPayment.confirmed_job_id === null,
  "Fake pending outcome did not keep the proposal awaiting payment without a job.",
);
const pendingAttempt = await admin
  .from("payment_attempts")
  .select("status")
  .eq("id", pendingPayment.payment_attempt_id)
  .single();
assert(
  !pendingAttempt.error && pendingAttempt.data?.status === "PENDING",
  "Fake pending outcome was not recorded as a PENDING payment attempt.",
);
const pendingJobs = await admin
  .from("jobs")
  .select("id")
  .eq("accepted_proposal_version_id", pendingProposal.accepted_version_id);
assert(
  !pendingJobs.error && pendingJobs.data?.length === 0,
  "Pending fake payment created a Job before payment success.",
);
const repeatedPendingCallback = await applyFakePayment(
  pendingProposalId,
  pendingNonce,
  "SUCCESS",
);
assert(
  repeatedPendingCallback.payment_attempt_id ===
    pendingPayment.payment_attempt_id &&
    repeatedPendingCallback.resulting_proposal_status === "AWAITING_PAYMENT" &&
    repeatedPendingCallback.confirmed_job_id === null,
  "Reusing an idempotency nonce changed a previously recorded pending result.",
);

const failedProposalId = await createDirectBooking(
  "Reserva para validar fallo y reintento de pago",
);
const failedPayment = await applyFakePayment(
  failedProposalId,
  crypto.randomUUID(),
  "FAILURE",
);
assert(
  failedPayment.resulting_proposal_status === "PAYMENT_FAILED" &&
    failedPayment.payment_attempt_id &&
    failedPayment.confirmed_job_id === null,
  "Fake failure outcome did not move the proposal to PAYMENT_FAILED.",
);
const failedProposal = await getProposal(failedProposalId);
const failedJobs = await admin
  .from("jobs")
  .select("id")
  .eq("accepted_proposal_version_id", failedProposal.accepted_version_id);
assert(
  !failedJobs.error && failedJobs.data?.length === 0,
  "Failed fake payment created a Job.",
);
const retriedPayment = await applyFakePayment(
  failedProposalId,
  crypto.randomUUID(),
  "SUCCESS",
);
assert(
  retriedPayment.resulting_proposal_status === "PAID" &&
    retriedPayment.confirmed_job_id,
  "A new payment attempt could not safely recover from PAYMENT_FAILED.",
);

const raceProposalId = await createDirectBooking(
  "Reserva para validar callbacks de pago concurrentes",
);
const raceProposal = await getProposal(raceProposalId);
const raceNonce = crypto.randomUUID();
const [racePaymentA, racePaymentB] = await Promise.all([
  admin.rpc("apply_fake_payment_result", {
    target_proposal_id: raceProposalId,
    payment_nonce: raceNonce,
    payment_outcome: "SUCCESS",
    actor_client_user_id: users.client.id,
  }),
  admin.rpc("apply_fake_payment_result", {
    target_proposal_id: raceProposalId,
    payment_nonce: raceNonce,
    payment_outcome: "SUCCESS",
    actor_client_user_id: users.client.id,
  }),
]);
for (const result of [racePaymentA, racePaymentB]) {
  assert(
    !result.error && result.data?.length === 1,
    `Concurrent fake payment callback failed: ${result.error?.message ?? "unknown"}`,
  );
}
assert(
  racePaymentA.data[0].payment_attempt_id ===
    racePaymentB.data[0].payment_attempt_id &&
    racePaymentA.data[0].confirmed_job_id ===
      racePaymentB.data[0].confirmed_job_id,
  "Concurrent duplicate callbacks diverged into different payment attempts or Jobs.",
);
const raceAttempts = await admin
  .from("payment_attempts")
  .select("id")
  .eq("proposal_id", raceProposalId)
  .eq("request_nonce", raceNonce);
assert(
  !raceAttempts.error && raceAttempts.data?.length === 1,
  "Concurrent duplicate callbacks created more than one payment attempt.",
);
const raceJobs = await admin
  .from("jobs")
  .select("id")
  .eq("accepted_proposal_version_id", raceProposal.accepted_version_id);
assert(
  !raceJobs.error && raceJobs.data?.length === 1,
  "Concurrent duplicate callbacks created more than one Job.",
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

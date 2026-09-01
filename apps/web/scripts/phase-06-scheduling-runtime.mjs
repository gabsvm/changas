import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase credentials are required for Phase 06 scheduling runtime checks.",
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
const password = `Phase06-scheduling-${runId}-Password1!`;
const users = {
  clientA: { email: `phase06-schedule-a-${runId}@example.test` },
  clientB: { email: `phase06-schedule-b-${runId}@example.test` },
  provider: { email: `phase06-schedule-provider-${runId}@example.test` },
  outsider: { email: `phase06-schedule-outsider-${runId}@example.test` },
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
    `Could not create scheduling user: ${error?.message ?? "unknown"}`,
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
const [clientA, clientB, provider, outsider] = await Promise.all([
  signIn(users.clientA),
  signIn(users.clientB),
  signIn(users.provider),
  signIn(users.outsider),
]);

const skill = await admin
  .from("skills")
  .select("id")
  .eq("slug", "reparacion-pc")
  .single();
assert(!skill.error && skill.data?.id, "Scheduling fixture skill is missing.");

const providerSlug = `phase06-scheduling-provider-${runId}`;
const serviceSlug = `phase06-scheduling-service-${runId}`;
assert(
  !(
    await admin.from("provider_profiles").insert({
      user_id: users.provider.id,
      status: "ACTIVE",
      onboarding_step: 4,
      public_slug: providerSlug,
      public_headline: "Phase 06 scheduling runtime provider",
    })
  ).error,
  "Could not create scheduling provider profile.",
);
assert(
  !(
    await admin.from("provider_skills").insert({
      provider_user_id: users.provider.id,
      skill_id: skill.data.id,
      is_featured: true,
    })
  ).error,
  "Could not attach scheduling provider skill.",
);
const service = await admin
  .from("services")
  .insert({
    provider_user_id: users.provider.id,
    skill_id: skill.data.id,
    public_slug: serviceSlug,
    title: "Visita técnica con agenda Phase 06",
    description:
      "Servicio sintético para validar disponibilidad recurrente, excepciones y holds temporales.",
    modality: "IN_PERSON",
    price_model: "FIXED",
    price_amount: 180000,
    currency_code: "ARS",
    accepts_offers: false,
    schedule_type: "FIXED_SLOT",
    expected_duration_minutes: 60,
    is_published: true,
    is_paused: false,
  })
  .select("id")
  .single();
assert(
  !service.error && service.data?.id,
  `Could not create scheduling service: ${service.error?.message ?? "unknown"}`,
);

const rule = await provider.rpc("upsert_provider_availability_rule", {
  target_rule_id: null,
  requested_weekday: 1,
  requested_start_time: "14:00:00",
  requested_end_time: "18:00:00",
  requested_timezone: "UTC",
  requested_is_active: true,
});
assert(
  !rule.error && rule.data,
  `Provider could not create recurring availability: ${rule.error?.message ?? "unknown"}`,
);

const invalidTimezone = await provider.rpc(
  "upsert_provider_availability_rule",
  {
    target_rule_id: null,
    requested_weekday: 1,
    requested_start_time: "14:00:00",
    requested_end_time: "18:00:00",
    requested_timezone: "Not/A_Timezone",
    requested_is_active: true,
  },
);
assert(Boolean(invalidTimezone.error), "Invalid timezone was accepted.");

const block = await provider.rpc("create_provider_availability_block", {
  requested_starts_at: "2026-09-07T16:00:00.000Z",
  requested_ends_at: "2026-09-07T16:30:00.000Z",
  requested_reason: "Turno personal",
});
assert(
  !block.error && block.data,
  `Provider could not create availability block: ${block.error?.message ?? "unknown"}`,
);

const outsiderRules = await outsider.from("availability_rules").select("id");
assert(
  !outsiderRules.error && outsiderRules.data?.length === 0,
  "Outsider can inspect another provider's availability rules.",
);
const outsiderHolds = await outsider.from("provider_slot_holds").select("id");
assert(
  Boolean(outsiderHolds.error) || outsiderHolds.data?.length === 0,
  "Outsider can inspect temporary provider holds.",
);

async function createAwaitingProposal(client, suffix, startsAt, endsAt) {
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
    scope_text: `Scheduling runtime ${suffix}`,
    proposed_price_amount: null,
    proposed_schedule_start_at: startsAt,
    proposed_schedule_end_at: endsAt,
    proposed_deadline_at: null,
    proposal_expires_at: null,
  });
  assert(
    !proposal.error && proposal.data,
    `Proposal ${suffix} failed: ${proposal.error?.message ?? "unknown"}`,
  );
  return proposal.data;
}

async function applyPaymentResult({ proposalId, nonce, status, actorUserId, suffix }) {
  const result = await admin.rpc("apply_payment_result", {
    target_proposal_id: proposalId,
    payment_nonce: nonce,
    payment_provider_name: "RUNTIME",
    payment_provider_reference: `schedule-${suffix}-${crypto.randomUUID()}`,
    payment_result_status: status,
    actor_client_user_id: actorUserId,
  });
  assert(
    !result.error && result.data?.[0],
    `Payment ${suffix} failed: ${result.error?.message ?? "unknown"}`,
  );
  return result.data[0];
}

async function readHold(proposalId, nonce) {
  const hold = await admin
    .from("provider_slot_holds")
    .select("id,released_at")
    .eq("proposal_id", proposalId)
    .eq("request_nonce", nonce)
    .single();
  assert(!hold.error && hold.data?.id, `Could not read hold: ${hold.error?.message}`);
  return hold.data;
}

const proposalA = await createAwaitingProposal(
  clientA,
  "hold-a",
  "2026-09-07T15:00:00.000Z",
  "2026-09-07T16:00:00.000Z",
);
const proposalB = await createAwaitingProposal(
  clientB,
  "hold-b",
  "2026-09-07T15:00:00.000Z",
  "2026-09-07T16:00:00.000Z",
);

const nonceA = crypto.randomUUID();
const heldA = await clientA.rpc("hold_proposal_slot", {
  target_proposal_id: proposalA,
  hold_nonce: nonceA,
  ttl_seconds: 600,
});
assert(
  !heldA.error && heldA.data,
  `First slot hold failed: ${heldA.error?.message ?? "unknown"}`,
);
const heldAAgain = await clientA.rpc("hold_proposal_slot", {
  target_proposal_id: proposalA,
  hold_nonce: nonceA,
  ttl_seconds: 600,
});
assert(
  !heldAAgain.error && heldAAgain.data === heldA.data,
  "Slot hold idempotency changed the hold identity.",
);

const conflictingHold = await clientB.rpc("hold_proposal_slot", {
  target_proposal_id: proposalB,
  hold_nonce: crypto.randomUUID(),
  ttl_seconds: 600,
});
assert(Boolean(conflictingHold.error), "Overlapping active hold was accepted.");

const releaseA = await clientA.rpc("release_proposal_slot_hold", {
  target_proposal_id: proposalA,
  hold_nonce: nonceA,
});
assert(
  !releaseA.error,
  `Hold release failed: ${releaseA.error?.message ?? "unknown"}`,
);

const nonceB = crypto.randomUUID();
const heldBAfterRelease = await clientB.rpc("hold_proposal_slot", {
  target_proposal_id: proposalB,
  hold_nonce: nonceB,
  ttl_seconds: 600,
});
assert(
  !heldBAfterRelease.error && heldBAfterRelease.data,
  "Released hold continued blocking the provider slot.",
);
await clientB.rpc("release_proposal_slot_hold", {
  target_proposal_id: proposalB,
  hold_nonce: nonceB,
});

const blockedProposal = await createAwaitingProposal(
  clientA,
  "blocked",
  "2026-09-07T16:00:00.000Z",
  "2026-09-07T16:30:00.000Z",
);
const blockedHold = await clientA.rpc("hold_proposal_slot", {
  target_proposal_id: blockedProposal,
  hold_nonce: crypto.randomUUID(),
  ttl_seconds: 600,
});
assert(
  Boolean(blockedHold.error),
  "Availability exception did not block a hold.",
);

const outsideRuleProposal = await createAwaitingProposal(
  clientA,
  "outside-rule",
  "2026-09-07T18:00:00.000Z",
  "2026-09-07T19:00:00.000Z",
);
const outsideRuleHold = await clientA.rpc("hold_proposal_slot", {
  target_proposal_id: outsideRuleProposal,
  hold_nonce: crypto.randomUUID(),
  ttl_seconds: 600,
});
assert(Boolean(outsideRuleHold.error), "Out-of-rule slot received a hold.");

const expiringA = await createAwaitingProposal(
  clientA,
  "expiring-a",
  "2026-09-07T14:00:00.000Z",
  "2026-09-07T14:30:00.000Z",
);
const expiringB = await createAwaitingProposal(
  clientB,
  "expiring-b",
  "2026-09-07T14:00:00.000Z",
  "2026-09-07T14:30:00.000Z",
);
const expiringNonce = crypto.randomUUID();
const expiringHold = await clientA.rpc("hold_proposal_slot", {
  target_proposal_id: expiringA,
  hold_nonce: expiringNonce,
  ttl_seconds: 60,
});
assert(
  !expiringHold.error && expiringHold.data,
  "Could not create expiring hold.",
);
assert(
  !(
    await admin
      .from("provider_slot_holds")
      .update({
        created_at: "2026-08-31T23:58:00.000Z",
        expires_at: "2026-08-31T23:59:00.000Z",
      })
      .eq("id", expiringHold.data)
  ).error,
  "Could not expire hold fixture.",
);
const afterExpiryNonce = crypto.randomUUID();
const afterExpiry = await clientB.rpc("hold_proposal_slot", {
  target_proposal_id: expiringB,
  hold_nonce: afterExpiryNonce,
  ttl_seconds: 600,
});
assert(
  !afterExpiry.error && afterExpiry.data,
  "Expired hold continued blocking the provider slot.",
);
await clientB.rpc("release_proposal_slot_hold", {
  target_proposal_id: expiringB,
  hold_nonce: afterExpiryNonce,
});

const raceProposalA = await createAwaitingProposal(
  clientA,
  "race-a",
  "2026-09-07T17:00:00.000Z",
  "2026-09-07T17:30:00.000Z",
);
const raceProposalB = await createAwaitingProposal(
  clientB,
  "race-b",
  "2026-09-07T17:00:00.000Z",
  "2026-09-07T17:30:00.000Z",
);
const raceNonceA = crypto.randomUUID();
const raceNonceB = crypto.randomUUID();
const [raceA, raceB] = await Promise.all([
  clientA.rpc("hold_proposal_slot", {
    target_proposal_id: raceProposalA,
    hold_nonce: raceNonceA,
    ttl_seconds: 600,
  }),
  clientB.rpc("hold_proposal_slot", {
    target_proposal_id: raceProposalB,
    hold_nonce: raceNonceB,
    ttl_seconds: 600,
  }),
]);
const raceSuccesses = [raceA, raceB].filter(
  (result) => !result.error && result.data,
).length;
const raceFailures = [raceA, raceB].filter((result) =>
  Boolean(result.error),
).length;
assert(
  raceSuccesses === 1 && raceFailures === 1,
  `Concurrent overlapping holds were not serialized safely: successes=${raceSuccesses}, failures=${raceFailures}`,
);
if (!raceA.error) {
  await clientA.rpc("release_proposal_slot_hold", {
    target_proposal_id: raceProposalA,
    hold_nonce: raceNonceA,
  });
} else {
  await clientB.rpc("release_proposal_slot_hold", {
    target_proposal_id: raceProposalB,
    hold_nonce: raceNonceB,
  });
}

const pendingProposal = await createAwaitingProposal(
  clientA,
  "payment-pending",
  "2026-09-07T14:30:00.000Z",
  "2026-09-07T15:00:00.000Z",
);
const pendingNonce = crypto.randomUUID();
const pendingHold = await clientA.rpc("hold_proposal_slot", {
  target_proposal_id: pendingProposal,
  hold_nonce: pendingNonce,
  ttl_seconds: 600,
});
assert(!pendingHold.error && pendingHold.data, "Could not create pending payment hold.");
const pendingPayment = await applyPaymentResult({
  proposalId: pendingProposal,
  nonce: pendingNonce,
  status: "PENDING",
  actorUserId: users.clientA.id,
  suffix: "pending",
});
assert(
  pendingPayment.resulting_proposal_status === "AWAITING_PAYMENT",
  "Pending payment changed proposal out of AWAITING_PAYMENT.",
);
assert(
  (await readHold(pendingProposal, pendingNonce)).released_at === null,
  "Pending payment released its temporary slot hold.",
);
await clientA.rpc("release_proposal_slot_hold", {
  target_proposal_id: pendingProposal,
  hold_nonce: pendingNonce,
});

const failedProposal = await createAwaitingProposal(
  clientB,
  "payment-failed",
  "2026-09-07T16:30:00.000Z",
  "2026-09-07T17:00:00.000Z",
);
const failedNonce = crypto.randomUUID();
const failedHold = await clientB.rpc("hold_proposal_slot", {
  target_proposal_id: failedProposal,
  hold_nonce: failedNonce,
  ttl_seconds: 600,
});
assert(!failedHold.error && failedHold.data, "Could not create failed payment hold.");
const failedPayment = await applyPaymentResult({
  proposalId: failedProposal,
  nonce: failedNonce,
  status: "FAILED",
  actorUserId: users.clientB.id,
  suffix: "failed",
});
assert(
  failedPayment.resulting_proposal_status === "PAYMENT_FAILED",
  "Failed payment did not move proposal to PAYMENT_FAILED.",
);
assert(
  (await readHold(failedProposal, failedNonce)).released_at !== null,
  "Failed payment retained its temporary slot hold.",
);

const freedAfterFailureProposal = await createAwaitingProposal(
  clientA,
  "payment-failed-freed",
  "2026-09-07T16:30:00.000Z",
  "2026-09-07T17:00:00.000Z",
);
const freedAfterFailureNonce = crypto.randomUUID();
const freedAfterFailure = await clientA.rpc("hold_proposal_slot", {
  target_proposal_id: freedAfterFailureProposal,
  hold_nonce: freedAfterFailureNonce,
  ttl_seconds: 600,
});
assert(
  !freedAfterFailure.error && freedAfterFailure.data,
  "Failed payment did not free the provider slot for another proposal.",
);
await clientA.rpc("release_proposal_slot_hold", {
  target_proposal_id: freedAfterFailureProposal,
  hold_nonce: freedAfterFailureNonce,
});

const successProposal = await createAwaitingProposal(
  clientA,
  "payment-success",
  "2026-09-07T17:30:00.000Z",
  "2026-09-07T18:00:00.000Z",
);
const successNonce = crypto.randomUUID();
const successHold = await clientA.rpc("hold_proposal_slot", {
  target_proposal_id: successProposal,
  hold_nonce: successNonce,
  ttl_seconds: 600,
});
assert(!successHold.error && successHold.data, "Could not create successful payment hold.");
const successfulPayment = await applyPaymentResult({
  proposalId: successProposal,
  nonce: successNonce,
  status: "SUCCEEDED",
  actorUserId: users.clientA.id,
  suffix: "success",
});
assert(
  successfulPayment.resulting_proposal_status === "PAID" &&
    successfulPayment.confirmed_job_id,
  "Successful payment did not confirm a Job.",
);
assert(
  (await readHold(successProposal, successNonce)).released_at !== null,
  "Successful payment did not consume its temporary slot hold.",
);
const consumedEvent = await admin
  .from("proposal_events")
  .select("id")
  .eq("proposal_id", successProposal)
  .eq("event_type", "PAYMENT_SLOT_CONSUMED");
assert(
  !consumedEvent.error && consumedEvent.data?.length === 1,
  "Successful fixed-slot payment did not audit hold consumption exactly once.",
);

console.log("Phase 06 scheduling/hold runtime security checks: PASS");

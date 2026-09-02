import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Local Supabase credentials are required for Phase 08 runtime checks.",
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
const password = `Phase08-${runId}-valid-password`;
const users = {
  alpha: { email: `phase08-alpha-${runId}@example.test` },
  beta: { email: `phase08-beta-${runId}@example.test` },
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
const [alpha, beta] = await Promise.all([
  signIn(users.alpha),
  signIn(users.beta),
]);

const alphaDefaults = await alpha.rpc("get_my_notification_preferences");
assert(
  !alphaDefaults.error && alphaDefaults.data?.length === 1,
  `Could not read default preferences: ${alphaDefaults.error?.message ?? "unknown"}`,
);
assert(
  alphaDefaults.data[0].push_actionable_enabled === false &&
    alphaDefaults.data[0].email_important_enabled === true &&
    alphaDefaults.data[0].promotional_enabled === false,
  "Notification defaults are not conservative.",
);

const alphaUpdated = await alpha.rpc("update_my_notification_preferences", {
  requested_push_actionable_enabled: true,
  requested_email_important_enabled: true,
  requested_job_reminders_enabled: true,
  requested_proposal_alerts_enabled: true,
  requested_verification_alerts_enabled: true,
  requested_promotional_enabled: false,
});
assert(
  !alphaUpdated.error && alphaUpdated.data?.[0]?.push_actionable_enabled === true,
  `Could not update notification preferences: ${alphaUpdated.error?.message ?? "unknown"}`,
);

const betaDefaults = await beta.rpc("get_my_notification_preferences");
assert(
  !betaDefaults.error &&
    betaDefaults.data?.[0]?.push_actionable_enabled === false,
  "Updating one user's preferences leaked into another account.",
);

const endpoint = `https://push.example.test/subscription/${runId}`;
const subscribed = await alpha.rpc("upsert_push_subscription", {
  subscription_endpoint: endpoint,
  subscription_p256dh: `p256dh-${runId}`,
  subscription_auth: `auth-${runId}`,
  subscription_user_agent: "Phase 08 runtime",
});
assert(
  !subscribed.error && subscribed.data,
  `Could not subscribe to push: ${subscribed.error?.message ?? "unknown"}`,
);

const alphaSubscriptions = await alpha
  .from("push_subscriptions")
  .select("id,user_id,endpoint");
assert(
  !alphaSubscriptions.error &&
    alphaSubscriptions.data?.length === 1 &&
    alphaSubscriptions.data[0].user_id === users.alpha.id,
  "Push subscription owner cannot read their own row.",
);
const betaSubscriptionsBefore = await beta
  .from("push_subscriptions")
  .select("id,user_id,endpoint");
assert(
  !betaSubscriptionsBefore.error && betaSubscriptionsBefore.data?.length === 0,
  "Push subscription RLS leaked another user's endpoint.",
);

const directNotificationInsert = await alpha.from("notifications").insert({
  recipient_user_id: users.alpha.id,
  kind: "JOB",
  title: "Should fail",
  body: "Browser roles cannot forge notifications.",
  action_url: "/jobs",
  source_event_type: "FORGED",
  source_event_id: crypto.randomUUID(),
});
assert(
  directNotificationInsert.error,
  "Authenticated users can forge notification rows directly.",
);
const directPreferenceUpdate = await alpha
  .from("notification_preferences")
  .update({ promotional_enabled: true })
  .eq("user_id", users.alpha.id);
assert(
  directPreferenceUpdate.error,
  "Authenticated users can bypass the preference RPC with direct DML.",
);
const directSubscriptionInsert = await alpha.from("push_subscriptions").insert({
  user_id: users.alpha.id,
  endpoint: `https://push.example.test/forged/${runId}`,
  p256dh: `p256dh-forged-${runId}`,
  auth_key: `auth-forged-${runId}`,
});
assert(
  directSubscriptionInsert.error,
  "Authenticated users can bypass the push subscription RPC with direct DML.",
);
const browserOutboxRead = await alpha
  .from("notification_delivery_outbox")
  .select("id");
assert(
  browserOutboxRead.error,
  "Authenticated users can read the delivery outbox.",
);

const sourceEventId = crypto.randomUUID();
const enqueued = await admin.rpc("enqueue_user_notification", {
  target_recipient_user_id: users.alpha.id,
  notification_kind_value: "JOB",
  safe_title: "Trabajo actualizado",
  safe_body: "Hay una actualización importante en uno de tus trabajos.",
  notification_action_url: "/jobs",
  source_event_type_value: "PHASE08_RUNTIME_JOB",
  source_event_id_value: sourceEventId,
  entity_type_value: "job",
  entity_id_value: null,
  push_eligible: true,
  email_eligible: true,
});
assert(
  !enqueued.error && enqueued.data,
  `Could not enqueue notification: ${enqueued.error?.message ?? "unknown"}`,
);

const duplicate = await admin.rpc("enqueue_user_notification", {
  target_recipient_user_id: users.alpha.id,
  notification_kind_value: "JOB",
  safe_title: "Trabajo actualizado",
  safe_body: "Hay una actualización importante en uno de tus trabajos.",
  notification_action_url: "/jobs",
  source_event_type_value: "PHASE08_RUNTIME_JOB",
  source_event_id_value: sourceEventId,
  entity_type_value: "job",
  entity_id_value: null,
  push_eligible: true,
  email_eligible: true,
});
assert(
  !duplicate.error && duplicate.data === enqueued.data,
  "Notification enqueue is not idempotent by source event.",
);

const alphaNotifications = await alpha.rpc("list_my_notifications", {
  page_size: 30,
  before_created_at: null,
  before_id: null,
});
assert(
  !alphaNotifications.error &&
    alphaNotifications.data?.length === 1 &&
    alphaNotifications.data[0].notification_id === enqueued.data,
  "Notification center cannot read the recipient's own event.",
);
const betaNotifications = await beta.rpc("list_my_notifications", {
  page_size: 30,
  before_created_at: null,
  before_id: null,
});
assert(
  !betaNotifications.error && betaNotifications.data?.length === 0,
  "Notification center leaked an event to another user.",
);

const alphaUnread = await alpha.rpc("get_my_notification_unread_count");
assert(
  !alphaUnread.error && Number(alphaUnread.data) === 1,
  "Unread count did not reflect the new notification.",
);
const betaCannotMark = await beta.rpc("mark_notification_read", {
  target_notification_id: enqueued.data,
});
assert(
  !betaCannotMark.error && betaCannotMark.data === false,
  "Another user can mark a notification they do not own.",
);
const alphaMarked = await alpha.rpc("mark_notification_read", {
  target_notification_id: enqueued.data,
});
assert(
  !alphaMarked.error && alphaMarked.data === true,
  "Recipient could not mark their notification as read.",
);
const alphaUnreadAfter = await alpha.rpc("get_my_notification_unread_count");
assert(
  !alphaUnreadAfter.error && Number(alphaUnreadAfter.data) === 0,
  "Unread count did not clear after mark-as-read.",
);

const claimed = await admin.rpc("claim_notification_deliveries", {
  requested_batch_size: 10,
  requested_lease_seconds: 120,
});
assert(
  !claimed.error && claimed.data?.length === 2,
  `Expected one push and one email delivery, got ${claimed.data?.length ?? 0}: ${claimed.error?.message ?? "unknown"}`,
);
assert(
  claimed.data.some(
    (row) => row.channel === "PUSH" && row.endpoint === endpoint && row.p256dh,
  ),
  "Push delivery claim is missing subscription material.",
);
assert(
  claimed.data.some(
    (row) => row.channel === "EMAIL" && row.recipient_email === users.alpha.email,
  ),
  "Email delivery claim is missing the recipient email.",
);

for (const delivery of claimed.data) {
  const recorded = await admin.rpc("record_notification_delivery_result", {
    target_delivery_id: delivery.delivery_id,
    target_lease_token: delivery.lease_token,
    delivery_succeeded: true,
    delivery_retryable: false,
    delivery_error_code: null,
  });
  assert(
    !recorded.error && recorded.data === true,
    `Could not record ${delivery.channel} delivery success: ${recorded.error?.message ?? "unknown"}`,
  );
}
const deliveredRows = await admin
  .from("notification_delivery_outbox")
  .select("channel,status,attempt_count")
  .eq("notification_id", enqueued.data);
assert(
  !deliveredRows.error &&
    deliveredRows.data?.length === 2 &&
    deliveredRows.data.every(
      (row) => row.status === "SENT" && row.attempt_count === 1,
    ),
  "Delivery results were not persisted exactly once.",
);

const betaClaimsEndpoint = await beta.rpc("upsert_push_subscription", {
  subscription_endpoint: endpoint,
  subscription_p256dh: `p256dh-beta-${runId}`,
  subscription_auth: `auth-beta-${runId}`,
  subscription_user_agent: "Phase 08 runtime beta",
});
assert(
  !betaClaimsEndpoint.error && betaClaimsEndpoint.data,
  `A browser endpoint could not be reassigned safely: ${betaClaimsEndpoint.error?.message ?? "unknown"}`,
);
const alphaSubscriptionsAfter = await alpha
  .from("push_subscriptions")
  .select("id,user_id,endpoint");
const betaSubscriptionsAfter = await beta
  .from("push_subscriptions")
  .select("id,user_id,endpoint");
assert(
  !alphaSubscriptionsAfter.error && alphaSubscriptionsAfter.data?.length === 0,
  "A reassigned push endpoint remains visible to the previous account.",
);
assert(
  !betaSubscriptionsAfter.error &&
    betaSubscriptionsAfter.data?.length === 1 &&
    betaSubscriptionsAfter.data[0].user_id === users.beta.id,
  "The push endpoint was not reassigned to the active account.",
);

const deleted = await beta.rpc("delete_push_subscription", {
  subscription_endpoint: endpoint,
});
assert(
  !deleted.error && deleted.data === true,
  "Push unsubscribe did not remove the active account endpoint.",
);

const markAll = await alpha.rpc("mark_all_notifications_read");
assert(
  !markAll.error && Number(markAll.data) === 0,
  "Mark-all-read should be idempotent when there are no unread notifications.",
);

console.log("Phase 08 notification authority runtime checks: PASS");

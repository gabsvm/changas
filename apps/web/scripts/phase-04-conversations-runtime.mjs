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
const anonymous = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const runId = crypto.randomUUID();
const password = `Phase04-${runId}-valid-password`;
const users = {
  client: { email: `phase04-client-${runId}@example.test`, id: undefined },
  provider: { email: `phase04-provider-${runId}@example.test`, id: undefined },
  outsider: { email: `phase04-outsider-${runId}@example.test`, id: undefined },
};

let conversationId;
let serviceId;
let skillId;
let attachmentPath;

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
    `Could not create user: ${error?.message ?? "unknown"}`,
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

try {
  await Promise.all(Object.values(users).map(createUser));

  const skill = await admin
    .from("skills")
    .select("id")
    .eq("slug", "reparacion-pc")
    .single();
  assert(
    !skill.error && skill.data?.id,
    "Phase 04 runtime skill fixture is missing.",
  );
  skillId = skill.data.id;

  const providerProfile = await admin.from("provider_profiles").insert({
    user_id: users.provider.id,
    status: "ACTIVE",
    onboarding_step: 4,
    public_slug: `phase04-provider-${runId}`,
    public_headline: "Phase 04 runtime provider",
  });
  assert(
    !providerProfile.error,
    `Could not create provider profile: ${providerProfile.error?.message ?? "unknown"}`,
  );

  const providerSkill = await admin.from("provider_skills").insert({
    provider_user_id: users.provider.id,
    skill_id: skillId,
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
      skill_id: skillId,
      public_slug: `phase04-service-${runId}`,
      title: "Soporte remoto Phase 04",
      description:
        "Servicio sintético para validar conversaciones y adjuntos privados de Phase 04.",
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
    `Could not create service: ${service.error?.message ?? "unknown"}`,
  );
  serviceId = service.data.id;

  const client = await signIn(users.client);
  const provider = await signIn(users.provider);
  const outsider = await signIn(users.outsider);

  const started = await client.rpc("start_service_conversation", {
    target_provider_slug: `phase04-provider-${runId}`,
    target_service_slug: `phase04-service-${runId}`,
  });
  assert(
    !started.error && started.data,
    `Could not start conversation: ${started.error?.message ?? "unknown"}`,
  );
  conversationId = started.data;

  const clientContext = await client.rpc("get_conversation_context", {
    target_conversation_id: conversationId,
  });
  assert(
    !clientContext.error && clientContext.data?.length === 1,
    "Client cannot read conversation context.",
  );

  const providerContext = await provider.rpc("get_conversation_context", {
    target_conversation_id: conversationId,
  });
  assert(
    !providerContext.error && providerContext.data?.length === 1,
    "Provider cannot read conversation context.",
  );

  const outsiderContext = await outsider.rpc("get_conversation_context", {
    target_conversation_id: conversationId,
  });
  assert(
    Boolean(outsiderContext.error),
    "Outsider can read conversation context.",
  );

  const initialText = await client.rpc("send_conversation_text", {
    target_conversation_id: conversationId,
    message_body: "Mensaje inicial de runtime",
    message_nonce: crypto.randomUUID(),
  });
  assert(
    !initialText.error && initialText.data,
    `Client could not send initial text: ${initialText.error?.message ?? "unknown"}`,
  );

  const blocked = await client.rpc("block_user_for_conversation", {
    target_conversation_id: conversationId,
    target_user_id: users.provider.id,
  });
  assert(
    !blocked.error && blocked.data === users.provider.id,
    `Client could not block provider: ${blocked.error?.message ?? "unknown"}`,
  );

  const blockState = await client.rpc("get_my_conversation_block_state", {
    target_conversation_id: conversationId,
  });
  assert(
    !blockState.error && blockState.data === users.provider.id,
    "Caller cannot read their own conversation block state.",
  );

  const blockedSend = await provider.rpc("send_conversation_text", {
    target_conversation_id: conversationId,
    message_body: "Este mensaje debe fallar mientras existe el bloqueo",
    message_nonce: crypto.randomUUID(),
  });
  assert(Boolean(blockedSend.error), "Blocked participant can still send text.");

  const historyWhileBlocked = await client.rpc("list_conversation_messages", {
    target_conversation_id: conversationId,
    page_size: 50,
    before_created_at: null,
    before_id: null,
  });
  assert(
    !historyWhileBlocked.error &&
      historyWhileBlocked.data?.some(
        (row) => row.message_id === initialText.data,
      ),
    "Blocking removed or hid the contractual message history.",
  );

  const unblocked = await client.rpc("unblock_user", {
    target_conversation_id: conversationId,
    target_user_id: users.provider.id,
  });
  assert(
    !unblocked.error && unblocked.data === users.provider.id,
    `Client could not unblock provider: ${unblocked.error?.message ?? "unknown"}`,
  );

  const restoredSend = await provider.rpc("send_conversation_text", {
    target_conversation_id: conversationId,
    message_body: "Envío restaurado luego del desbloqueo",
    message_nonce: crypto.randomUUID(),
  });
  assert(
    !restoredSend.error && restoredSend.data,
    "Unblocking did not restore participant messaging.",
  );

  const participantReport = await client.rpc("report_conversation", {
    target_conversation_id: conversationId,
    report_category: "SCAM",
    report_reason: "Fixture de seguridad Phase 04",
  });
  assert(
    !participantReport.error && participantReport.data,
    `Participant report failed: ${participantReport.error?.message ?? "unknown"}`,
  );

  const outsiderReport = await outsider.rpc("report_conversation", {
    target_conversation_id: conversationId,
    report_category: "SCAM",
    report_reason: "Outsider must not report this conversation",
  });
  assert(Boolean(outsiderReport.error), "Outsider can report another conversation.");

  const warning = await client.rpc("record_conversation_moderation_warning", {
    target_conversation_id: conversationId,
    signal_types: ["EMAIL", "EXTERNAL_CONTACT_REQUEST"],
  });
  assert(
    !warning.error && warning.data,
    `Moderation warning audit failed: ${warning.error?.message ?? "unknown"}`,
  );

  const warningRow = await admin
    .from("conversation_moderation_events")
    .select("event_type,metadata")
    .eq("id", warning.data)
    .single();
  assert(
    !warningRow.error &&
      warningRow.data?.event_type === "CONTACT_LEAKAGE_WARNING",
    "Moderation warning event was not persisted.",
  );
  const serializedWarning = JSON.stringify(warningRow.data?.metadata ?? {});
  assert(
    serializedWarning.includes("EMAIL") &&
      serializedWarning.includes("EXTERNAL_CONTACT_REQUEST"),
    "Moderation warning did not preserve signal types.",
  );
  assert(
    !serializedWarning.includes("example.com") &&
      !serializedWarning.includes("Mensaje inicial"),
    "Moderation warning metadata unexpectedly stores raw message text.",
  );

  const outsiderWarning = await outsider.rpc(
    "record_conversation_moderation_warning",
    {
      target_conversation_id: conversationId,
      signal_types: ["EMAIL"],
    },
  );
  assert(
    Boolean(outsiderWarning.error),
    "Outsider can create moderation events for another conversation.",
  );

  const nonce = crypto.randomUUID();
  const message = await client.rpc("create_conversation_attachment_message", {
    target_conversation_id: conversationId,
    attachment_kind: "FILE",
    message_nonce: nonce,
  });
  assert(
    !message.error && message.data,
    `Could not create attachment message: ${message.error?.message ?? "unknown"}`,
  );

  const attachmentBytes = new TextEncoder().encode(
    "phase-04-private-attachment",
  );
  attachmentPath = `${conversationId}/${message.data}/${crypto.randomUUID()}/runtime.txt`;
  const upload = await client.storage
    .from("conversation-attachments")
    .upload(
      attachmentPath,
      new Blob([attachmentBytes], { type: "text/plain" }),
      {
        contentType: "text/plain",
        upsert: false,
      },
    );
  assert(
    !upload.error,
    `Participant upload failed: ${upload.error?.message ?? "unknown"}`,
  );

  const registration = await client.rpc("register_conversation_attachment", {
    target_message_id: message.data,
    object_path: attachmentPath,
    attachment_mime_type: "text/plain",
    attachment_size_bytes: attachmentBytes.byteLength,
    attachment_original_name: "runtime.txt",
  });
  assert(
    !registration.error && registration.data,
    `Attachment registration failed: ${registration.error?.message ?? "unknown"}`,
  );

  const clientDownload = await client.storage
    .from("conversation-attachments")
    .download(attachmentPath);
  assert(
    !clientDownload.error && clientDownload.data,
    "Client cannot download their private attachment.",
  );

  const providerDownload = await provider.storage
    .from("conversation-attachments")
    .download(attachmentPath);
  assert(
    !providerDownload.error && providerDownload.data,
    "Provider cannot download participant attachment.",
  );

  const outsiderDownload = await outsider.storage
    .from("conversation-attachments")
    .download(attachmentPath);
  assert(
    Boolean(outsiderDownload.error),
    "Outsider can download a private conversation attachment.",
  );

  const anonymousDownload = await anonymous.storage
    .from("conversation-attachments")
    .download(attachmentPath);
  assert(
    Boolean(anonymousDownload.error),
    "Anonymous user can download a private conversation attachment.",
  );

  const participantSigned = await provider.storage
    .from("conversation-attachments")
    .createSignedUrl(attachmentPath, 300);
  assert(
    !participantSigned.error && participantSigned.data?.signedUrl,
    "Participant cannot create an authorized signed attachment URL.",
  );

  const outsiderSigned = await outsider.storage
    .from("conversation-attachments")
    .createSignedUrl(attachmentPath, 300);
  assert(
    Boolean(outsiderSigned.error),
    "Outsider can create a signed URL for a private attachment.",
  );

  console.log("Phase 04 conversation runtime security checks: PASS");
} finally {
  if (attachmentPath) {
    await admin.storage
      .from("conversation-attachments")
      .remove([attachmentPath]);
  }
  if (conversationId) {
    await admin.from("conversations").delete().eq("id", conversationId);
  }
  if (serviceId) {
    await admin.from("services").delete().eq("id", serviceId);
  }
  if (users.provider.id && skillId) {
    await admin
      .from("provider_skills")
      .delete()
      .eq("provider_user_id", users.provider.id)
      .eq("skill_id", skillId);
    await admin
      .from("provider_profiles")
      .delete()
      .eq("user_id", users.provider.id);
  }
  for (const user of Object.values(users)) {
    if (user.id) await admin.auth.admin.deleteUser(user.id);
  }
}

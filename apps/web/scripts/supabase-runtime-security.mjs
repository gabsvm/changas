import { readFile } from "node:fs/promises";
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
const password = `Phase01-${runId}-valid-password`;
const users = {
  owner: {
    email: `phase01-owner-${runId}@example.test`,
    id: undefined,
  },
  other: {
    email: `phase01-other-${runId}@example.test`,
    id: undefined,
  },
};
let documentPath;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createSyntheticUser(user) {
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { display_name: user.email.split("@")[0] },
  });

  assert(
    !error && data.user,
    `Could not create synthetic user: ${error?.message ?? "unknown error"}`,
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
    `Could not sign in synthetic user: ${error?.message ?? "unknown error"}`,
  );
  return { client, user: data.user };
}

try {
  await createSyntheticUser(users.owner);
  await createSyntheticUser(users.other);

  const owner = await signIn(users.owner);
  const other = await signIn(users.other);
  const anonymous = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const ownProfile = await owner.client
    .from("profiles")
    .select("id")
    .eq("id", users.owner.id)
    .single();
  assert(
    !ownProfile.error && ownProfile.data?.id === users.owner.id,
    "Owner could not read their profile.",
  );

  const ownProfileUpdate = await owner.client
    .from("profiles")
    .update({ bio: "synthetic owner update" })
    .eq("id", users.owner.id)
    .select("id")
    .single();
  assert(
    !ownProfileUpdate.error,
    `Owner could not update their profile: ${ownProfileUpdate.error?.message ?? "unknown error"}`,
  );

  const ownProvider = await owner.client
    .from("provider_profiles")
    .insert({
      user_id: users.owner.id,
      status: "PROFILE_INCOMPLETE",
      onboarding_step: 1,
    })
    .select("user_id")
    .single();
  assert(
    !ownProvider.error,
    `Owner could not create provider profile: ${ownProvider.error?.message ?? "unknown error"}`,
  );

  const ownProviderUpdate = await owner.client
    .from("provider_profiles")
    .update({ onboarding_step: 2 })
    .eq("user_id", users.owner.id)
    .select("onboarding_step")
    .single();
  assert(
    !ownProviderUpdate.error && ownProviderUpdate.data?.onboarding_step === 2,
    "Owner could not update onboarding progress.",
  );

  const privateReadByOther = await other.client
    .from("profile_private")
    .select("user_id")
    .eq("user_id", users.owner.id);
  assert(
    !privateReadByOther.error && privateReadByOther.data.length === 0,
    "User B could read User A private profile data.",
  );

  const privateUpdateByOther = await other.client
    .from("profile_private")
    .update({ legal_name: "cross-user write" })
    .eq("user_id", users.owner.id)
    .select("user_id");
  assert(
    !privateUpdateByOther.error && privateUpdateByOther.data.length === 0,
    "User B could modify User A private profile data.",
  );

  const selfActivation = await owner.client
    .from("provider_profiles")
    .update({ status: "ACTIVE" })
    .eq("user_id", users.owner.id)
    .select("status");
  assert(
    selfActivation.error?.code === "42501",
    `Provider self-activation was not rejected: ${selfActivation.error?.message ?? "no error"}`,
  );

  const fixture = await readFile(
    new URL("../fixtures/synthetic-identity.txt", import.meta.url),
  );
  documentPath = `${users.owner.id}/runtime-${runId}.png`;
  const upload = await owner.client.storage
    .from("identity-documents")
    .upload(documentPath, new Blob([fixture], { type: "image/png" }), {
      contentType: "image/png",
      upsert: false,
    });
  assert(
    !upload.error,
    `Owner could not upload private fixture: ${upload.error?.message ?? "unknown error"}`,
  );

  const ownerDownload = await owner.client.storage
    .from("identity-documents")
    .download(documentPath);
  assert(
    !ownerDownload.error && ownerDownload.data,
    "Owner could not access their uploaded document.",
  );

  const otherDownload = await other.client.storage
    .from("identity-documents")
    .download(documentPath);
  assert(otherDownload.error, "User B could read User A identity document.");

  const anonymousDownload = await anonymous.storage
    .from("identity-documents")
    .download(documentPath);
  assert(
    anonymousDownload.error,
    "Anonymous user could read a private identity document.",
  );

  console.log("Supabase runtime security checks: PASS");
} finally {
  if (documentPath) {
    await admin.storage.from("identity-documents").remove([documentPath]);
  }
  for (const user of [users.owner, users.other]) {
    if (user.id) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

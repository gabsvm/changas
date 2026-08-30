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
let certificationPath;
let portfolioPath;
let serviceId;
let certificationId;
let portfolioId;

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

  const fixture = Buffer.from(
    (
      await readFile(
        new URL("../fixtures/synthetic-identity.png.b64", import.meta.url),
        "utf8",
      )
    ).trim(),
    "base64",
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

  const activation = await admin
    .from("provider_profiles")
    .update({
      status: "ACTIVE",
      public_slug: `runtime-${runId}`,
      public_headline: "Runtime security fixture",
    })
    .eq("user_id", users.owner.id)
    .select("user_id")
    .single();
  assert(
    !activation.error,
    `Could not prepare active provider fixture: ${activation.error?.message ?? "unknown error"}`,
  );

  const skill = await owner.client
    .from("skills")
    .select("id")
    .eq("slug", "reparacion-pc")
    .single();
  assert(!skill.error && skill.data?.id, "Catalog skill fixture is missing.");

  const providerSkill = await owner.client.from("provider_skills").insert({
    provider_user_id: users.owner.id,
    skill_id: skill.data.id,
    is_featured: true,
  });
  assert(!providerSkill.error, "Owner could not add their catalog skill.");

  const service = await owner.client
    .from("services")
    .insert({
      provider_user_id: users.owner.id,
      skill_id: skill.data.id,
      public_slug: `runtime-service-${runId}`,
      title: "Runtime support service",
      description: "Synthetic service used to validate Phase 02 runtime rules.",
      modality: "REMOTE",
      price_model: "FIXED",
      price_amount: 1000,
      currency_code: "ARS",
      accepts_offers: true,
      schedule_type: "UNSCHEDULED",
      is_published: true,
    })
    .select("id, public_slug")
    .single();
  assert(
    !service.error && service.data,
    `Owner could not publish their service: ${service.error?.message ?? "unknown error"}`,
  );
  serviceId = service.data.id;

  const publicService = await anonymous
    .from("public_provider_services")
    .select("public_slug, provider_slug")
    .eq("public_slug", service.data.public_slug)
    .single();
  assert(
    !publicService.error &&
      publicService.data?.provider_slug === `runtime-${runId}`,
    "Anonymous user could not read the published public service projection.",
  );

  const privateExperience = await owner.client.from("experiences").insert({
    provider_user_id: users.owner.id,
    title: "Synthetic runtime experience",
    started_on: "2021-01-01",
    is_public: true,
  });
  assert(
    !privateExperience.error,
    "Owner could not write their public experience.",
  );

  certificationPath = `${users.owner.id}/runtime-${runId}.png`;
  const certificationUpload = await owner.client.storage
    .from("provider-certification-evidence")
    .upload(certificationPath, new Blob([fixture], { type: "image/png" }), {
      contentType: "image/png",
      upsert: false,
    });
  assert(
    !certificationUpload.error,
    `Owner could not upload private certification evidence: ${certificationUpload.error?.message ?? "unknown error"}`,
  );
  const certification = await owner.client
    .from("certifications")
    .insert({
      provider_user_id: users.owner.id,
      title: "Synthetic runtime certification",
      is_public: true,
      evidence_path: certificationPath,
      evidence_mime_type: "image/png",
      evidence_file_size_bytes: fixture.length,
    })
    .select("id")
    .single();
  assert(
    !certification.error && certification.data,
    "Owner could not register certification metadata.",
  );
  certificationId = certification.data.id;

  const ownerCertification = await owner.client.storage
    .from("provider-certification-evidence")
    .download(certificationPath);
  assert(
    !ownerCertification.error && ownerCertification.data,
    "Owner could not read private certification evidence.",
  );
  const otherCertification = await other.client.storage
    .from("provider-certification-evidence")
    .download(certificationPath);
  assert(
    otherCertification.error,
    "User B could read private certification evidence.",
  );
  const anonymousCertification = await anonymous.storage
    .from("provider-certification-evidence")
    .download(certificationPath);
  assert(
    anonymousCertification.error,
    "Anonymous user could read private certification evidence.",
  );

  portfolioPath = `${users.owner.id}/runtime-${runId}.png`;
  const portfolioUpload = await owner.client.storage
    .from("provider-portfolio")
    .upload(portfolioPath, new Blob([fixture], { type: "image/png" }), {
      contentType: "image/png",
      upsert: false,
    });
  assert(
    !portfolioUpload.error,
    `Owner could not upload portfolio fixture: ${portfolioUpload.error?.message ?? "unknown error"}`,
  );
  const portfolio = await owner.client
    .from("portfolio_items")
    .insert({
      provider_user_id: users.owner.id,
      title: "Synthetic public portfolio",
      description: "Synthetic image only.",
      media_path: portfolioPath,
      media_mime_type: "image/png",
      media_file_size_bytes: fixture.length,
      is_public: true,
    })
    .select("id")
    .single();
  assert(
    !portfolio.error && portfolio.data,
    "Owner could not register public portfolio metadata.",
  );
  portfolioId = portfolio.data.id;
  const anonymousPortfolio = await anonymous.storage
    .from("provider-portfolio")
    .download(portfolioPath);
  assert(
    !anonymousPortfolio.error && anonymousPortfolio.data,
    "Anonymous user could not read intended public portfolio media.",
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
  if (certificationPath) {
    await admin.storage
      .from("provider-certification-evidence")
      .remove([certificationPath]);
  }
  if (portfolioPath) {
    await admin.storage.from("provider-portfolio").remove([portfolioPath]);
  }
  if (serviceId) await admin.from("services").delete().eq("id", serviceId);
  if (certificationId)
    await admin.from("certifications").delete().eq("id", certificationId);
  if (portfolioId)
    await admin.from("portfolio_items").delete().eq("id", portfolioId);
  for (const user of [users.owner, users.other]) {
    if (user.id) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

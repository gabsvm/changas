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
const password = "Phase03-" + runId + "-valid-password";
const users = {
  owner: { email: "phase03-owner-" + runId + "@example.test", id: null },
  other: { email: "phase03-other-" + runId + "@example.test", id: null },
  coverage: {
    email: "phase03-coverage-" + runId + "@example.test",
    id: null,
  },
};
const serviceIds = [];
const areaIds = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    "Could not create user: " + (error?.message ?? "unknown error"),
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
    "Could not sign in: " + (error?.message ?? "unknown error"),
  );
  return client;
}

async function getSkill(slug) {
  const { data, error } = await admin
    .from("skills")
    .select("id")
    .eq("slug", slug)
    .single();
  assert(!error && data, "Missing catalog skill " + slug);
  return data.id;
}

async function createService(
  client,
  userId,
  skillId,
  slug,
  title,
  description,
  modality,
  priceModel = "FIXED",
  priceAmount = 100000,
) {
  const { data, error } = await client
    .from("services")
    .insert({
      provider_user_id: userId,
      skill_id: skillId,
      public_slug: slug,
      title,
      description,
      modality,
      price_model: priceModel,
      price_amount: priceModel === "QUOTE" ? null : priceAmount,
      currency_code: "ARS",
      accepts_offers: true,
      schedule_type: "UNSCHEDULED",
      is_published: true,
    })
    .select("id, public_slug")
    .single();
  assert(
    !error && data,
    "Could not create discovery service: " +
      (error?.message ?? "unknown error"),
  );
  serviceIds.push(data.id);
  return data;
}

try {
  await createSyntheticUser(users.owner);
  await createSyntheticUser(users.other);
  await createSyntheticUser(users.coverage);
  const owner = await signIn(users.owner);
  const other = await signIn(users.other);
  const anonymous = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const ownerProvider = await owner
    .from("provider_profiles")
    .insert({
      user_id: users.owner.id,
      status: "PROFILE_INCOMPLETE",
      onboarding_step: 1,
      public_slug: "runtime-discovery-" + runId,
      public_headline: "Discovery runtime fixture",
    })
    .select("user_id")
    .single();
  assert(!ownerProvider.error, "Could not create owner provider.");

  const selfActivation = await owner
    .from("provider_profiles")
    .update({ status: "ACTIVE" })
    .eq("user_id", users.owner.id)
    .select("status");
  assert(
    selfActivation.error?.code === "42501",
    "Provider owner could self-activate.",
  );

  const activation = await admin
    .from("provider_profiles")
    .update({ status: "ACTIVE" })
    .eq("user_id", users.owner.id);
  assert(!activation.error, "Could not activate owner fixture.");

  const otherProvider = await admin.from("provider_profiles").insert({
    user_id: users.other.id,
    status: "ACTIVE",
    onboarding_step: 4,
    public_slug: "runtime-discovery-other-" + runId,
    public_headline: "Other discovery fixture",
  });
  assert(!otherProvider.error, "Could not create other provider.");

  const coverageProvider = await admin.from("provider_profiles").insert({
    user_id: users.coverage.id,
    status: "ACTIVE",
    onboarding_step: 4,
    public_slug: "runtime-discovery-coverage-" + runId,
    public_headline: "Coverage discovery fixture",
  });
  assert(!coverageProvider.error, "Could not create coverage provider.");

  const pcSkill = await getSkill("reparacion-pc");
  const cameraSkill = await getSkill("instalacion-camaras");
  const englishSkill = await getSkill("ingles-conversacional");
  const electricianSkill = await getSkill("electricista");
  for (const skillId of [
    pcSkill,
    cameraSkill,
    englishSkill,
    electricianSkill,
  ]) {
    const result = await owner.from("provider_skills").insert({
      provider_user_id: users.owner.id,
      skill_id: skillId,
    });
    assert(!result.error, "Could not add owner catalog skill.");
  }
  const otherSkill = await admin.from("provider_skills").insert({
    provider_user_id: users.other.id,
    skill_id: cameraSkill,
  });
  assert(!otherSkill.error, "Could not add other catalog skill.");
  const coverageSkill = await admin.from("provider_skills").insert({
    provider_user_id: users.coverage.id,
    skill_id: electricianSkill,
  });
  assert(!coverageSkill.error, "Could not add coverage catalog skill.");

  await createService(
    owner,
    users.owner.id,
    pcSkill,
    "runtime-pc-" + runId,
    "Arreglar PC que se apaga",
    "Diagnóstico sintético para arreglar una PC que se apaga y vuelve a iniciar.",
    "REMOTE",
  );
  await createService(
    owner,
    users.owner.id,
    cameraSkill,
    "runtime-camara-" + runId,
    "Instalar cámara de seguridad",
    "Instalación sintética y configuración inicial de una cámara para el hogar.",
    "BOTH",
  );
  await createService(
    owner,
    users.owner.id,
    englishSkill,
    "runtime-ingles-" + runId,
    "Clases de inglés conversacional",
    "Práctica sintética de conversación en inglés para estudiar y trabajar.",
    "REMOTE",
    "HOURLY",
    180000,
  );
  await createService(
    owner,
    users.owner.id,
    electricianSkill,
    "runtime-electricista-" + runId,
    "Electricista para reparaciones del hogar",
    "Servicio sintético de electricista para reparaciones e instalaciones seguras.",
    "IN_PERSON",
    "QUOTE",
  );
  const inactiveService = await admin
    .from("services")
    .insert({
      provider_user_id: users.other.id,
      skill_id: cameraSkill,
      public_slug: "runtime-inactive-area-" + runId,
      title: "Cámara con área inactiva",
      description: "Servicio sintético con un área deliberadamente inactiva.",
      modality: "IN_PERSON",
      price_model: "FIXED",
      price_amount: 100000,
      currency_code: "ARS",
      schedule_type: "UNSCHEDULED",
      is_published: true,
    })
    .select("id")
    .single();
  assert(
    !inactiveService.error && inactiveService.data,
    "Could not create inactive-area service.",
  );
  serviceIds.push(inactiveService.data.id);

  await createService(
    admin,
    users.coverage.id,
    electricianSkill,
    "runtime-coverage-" + runId,
    "Cobertura de área",
    "Fixture sintético para validar el radio propio del proveedor.",
    "IN_PERSON",
    "FIXED",
    900000,
  );

  const area = await admin
    .from("service_areas")
    .insert([
      {
        provider_user_id: users.owner.id,
        label: "Área cercana sintética",
        center: "SRID=4326;POINT(-58.43 -34.58)",
        radius_meters: 5000,
        is_active: true,
      },
      {
        provider_user_id: users.owner.id,
        label: "Área lejana sintética",
        center: "SRID=4326;POINT(-58.60 -34.70)",
        radius_meters: 5000,
        is_active: true,
      },
      {
        provider_user_id: users.other.id,
        label: "Área inactiva sintética",
        center: "SRID=4326;POINT(-58.43 -34.58)",
        radius_meters: 5000,
        is_active: false,
      },
    ])
    .select("id");
  assert(
    !area.error && area.data?.length === 3,
    "Could not create service-area fixtures.",
  );
  areaIds.push(...area.data.map((entry) => entry.id));
  const coverageArea = await admin
    .from("service_areas")
    .insert({
      provider_user_id: users.coverage.id,
      label: "Cobertura variable sintética",
      center: "SRID=4326;POINT(-58.43 -34.76)",
      radius_meters: 5000,
      is_active: true,
    })
    .select("id")
    .single();
  assert(
    !coverageArea.error && coverageArea.data,
    "Could not create coverage area.",
  );
  areaIds.push(coverageArea.data.id);

  const requiredQueries = [
    "electricista",
    "arreglar pc",
    "pc se apaga",
    "clases ingles",
    "instalar camara",
  ];
  for (const query of requiredQueries) {
    const { data, error } = await anonymous.rpc(
      "search_discovery_services_v2",
      {
        query_text: query,
        page_number: 1,
        page_size: 24,
      },
    );
    assert(
      !error && data?.length,
      "No public result for required query: " + query,
    );
    assert(
      data.some((row) => row.provider_slug === "runtime-discovery-" + runId),
      "Required query returned no owner fixture: " + query,
    );
  }

  const filtered = await anonymous.rpc("search_discovery_services_v2", {
    skill_filter: "ingles-conversacional",
    price_model_filter: "HOURLY",
    min_price: 100000,
    max_price: 200000,
    accepts_offers_filter: true,
    page_number: 1,
    page_size: 24,
  });
  assert(
    !filtered.error &&
      filtered.data?.some(
        (row) => row.service_slug === "runtime-ingles-" + runId,
      ),
    "Combined category/skill, price, and offer filters did not narrow results.",
  );

  const inside = await anonymous.rpc("search_discovery_services_v2", {
    query_text: "electricista",
    modality_filter: "IN_PERSON",
    origin_lat: -34.58,
    origin_lng: -58.43,
    radius_meters: 1000,
    page_number: 1,
    page_size: 24,
  });
  assert(
    !inside.error &&
      inside.data?.some(
        (row) => row.service_slug === "runtime-electricista-" + runId,
      ),
    "Inside-radius service was not returned.",
  );
  assert(
    inside.data.every(
      (row) =>
        !Object.hasOwn(row, "center") &&
        !Object.hasOwn(row, "email") &&
        !Object.hasOwn(row, "exact_address"),
    ),
    "Discovery leaked private or exact location fields.",
  );
  assert(
    inside.data.every((row) => Number.isInteger(row.distance_meters)),
    "Radius result did not include safe approximate distance.",
  );

  const outside = await anonymous.rpc("search_discovery_services_v2", {
    query_text: "electricista",
    modality_filter: "IN_PERSON",
    origin_lat: -34.8,
    origin_lng: -58.8,
    radius_meters: 1000,
    page_number: 1,
    page_size: 24,
  });
  assert(
    !outside.error &&
      !outside.data?.some(
        (row) => row.service_slug === "runtime-electricista-" + runId,
      ),
    "Outside-radius service was returned.",
  );

  const coverageOutsideProviderRadius = await anonymous.rpc(
    "search_discovery_services_v2",
    {
      query_text: "cobertura",
      modality_filter: "IN_PERSON",
      origin_lat: -34.58,
      origin_lng: -58.43,
      radius_meters: 25000,
      page_number: 1,
      page_size: 24,
    },
  );
  assert(
    !coverageOutsideProviderRadius.error &&
      !coverageOutsideProviderRadius.data?.some(
        (row) => row.service_slug === "runtime-coverage-" + runId,
      ),
    "Provider coverage radius was not enforced.",
  );
  const coverageAreaInsideBothRadii = await admin
    .from("service_areas")
    .update({
      center: "SRID=4326;POINT(-58.43 -34.616)",
      radius_meters: 5000,
    })
    .eq("id", coverageArea.data.id);
  assert(!coverageAreaInsideBothRadii.error, "Could not update coverage area.");
  const coverageInside = await anonymous.rpc("search_discovery_services_v2", {
    query_text: "cobertura",
    modality_filter: "IN_PERSON",
    origin_lat: -34.58,
    origin_lng: -58.43,
    radius_meters: 10000,
    page_number: 1,
    page_size: 24,
  });
  assert(
    !coverageInside.error &&
      coverageInside.data?.some(
        (row) => row.service_slug === "runtime-coverage-" + runId,
      ),
    "Provider inside both radii was not returned.",
  );
  const coverageAreaOutsideClientRadius = await admin
    .from("service_areas")
    .update({
      center: "SRID=4326;POINT(-58.43 -34.652)",
      radius_meters: 10000,
    })
    .eq("id", coverageArea.data.id);
  assert(
    !coverageAreaOutsideClientRadius.error,
    "Could not update client-radius coverage area.",
  );
  const coverageOutsideClientRadius = await anonymous.rpc(
    "search_discovery_services_v2",
    {
      query_text: "cobertura",
      modality_filter: "IN_PERSON",
      origin_lat: -34.58,
      origin_lng: -58.43,
      radius_meters: 5000,
      page_number: 1,
      page_size: 24,
    },
  );
  assert(
    !coverageOutsideClientRadius.error &&
      !coverageOutsideClientRadius.data?.some(
        (row) => row.service_slug === "runtime-coverage-" + runId,
      ),
    "Client discovery radius was not enforced independently.",
  );

  const remote = await anonymous.rpc("search_discovery_services_v2", {
    query_text: "clases ingles",
    modality_filter: "REMOTE",
    origin_lat: -34.8,
    origin_lng: -58.8,
    radius_meters: 1000,
    page_number: 1,
    page_size: 24,
  });
  assert(
    !remote.error &&
      remote.data?.some(
        (row) => row.service_slug === "runtime-ingles-" + runId,
      ),
    "Remote service was disadvantaged by physical radius.",
  );

  const inactiveArea = await anonymous.rpc("search_discovery_services_v2", {
    query_text: "cámara",
    modality_filter: "IN_PERSON",
    origin_lat: -34.58,
    origin_lng: -58.43,
    radius_meters: 1000,
    page_number: 1,
    page_size: 24,
  });
  assert(
    !inactiveArea.error &&
      !inactiveArea.data?.some(
        (row) => row.service_slug === "runtime-inactive-area-" + runId,
      ),
    "Inactive service area was used for discovery.",
  );

  const firstPage = await anonymous.rpc("search_discovery_services_v2", {
    page_number: 1,
    page_size: 1,
  });
  assert(
    !firstPage.error &&
      firstPage.data?.length === 1 &&
      firstPage.data[0].has_more === true,
    "Discovery pagination did not report an available next page.",
  );

  const favorite = await owner.rpc("set_provider_favorite", {
    target_provider_slug: "runtime-discovery-" + runId,
    should_favorite: true,
  });
  assert(
    !favorite.error && favorite.data === true,
    "Owner could not add a provider favorite.",
  );
  const duplicateFavorite = await owner.rpc("set_provider_favorite", {
    target_provider_slug: "runtime-discovery-" + runId,
    should_favorite: true,
  });
  assert(!duplicateFavorite.error, "Duplicate favorite operation failed.");
  const favoriteCount = await admin
    .from("provider_favorites")
    .select("provider_user_id", { count: "exact", head: true })
    .eq("user_id", users.owner.id);
  assert(
    !favoriteCount.error && favoriteCount.count === 1,
    "Duplicate favorites were stored.",
  );
  const otherFavorite = await other
    .from("provider_favorites")
    .insert({ user_id: users.owner.id, provider_user_id: users.owner.id });
  assert(
    otherFavorite.error?.code === "42501" ||
      (!otherFavorite.error && otherFavorite.data?.length === 0),
    "User B could write User A favorites.",
  );
  const listed = await owner.rpc("list_my_favorite_providers");
  assert(
    !listed.error &&
      listed.data?.some(
        (row) => row.provider_slug === "runtime-discovery-" + runId,
      ),
    "Owner could not list their favorite provider.",
  );
  const removed = await owner.rpc("set_provider_favorite", {
    target_provider_slug: "runtime-discovery-" + runId,
    should_favorite: false,
  });
  assert(
    !removed.error && removed.data === false,
    "Owner could not remove a provider favorite.",
  );

  const pausedProvider = await admin
    .from("provider_profiles")
    .update({ marketplace_paused: true })
    .eq("user_id", users.owner.id);
  assert(!pausedProvider.error, "Could not pause favorite provider fixture.");
  const pausedFavorite = await owner.rpc("set_provider_favorite", {
    target_provider_slug: "runtime-discovery-" + runId,
    should_favorite: true,
  });
  assert(pausedFavorite.error, "Paused provider could still be favorited.");
  await admin
    .from("provider_profiles")
    .update({ marketplace_paused: false, status: "PROFILE_INCOMPLETE" })
    .eq("user_id", users.owner.id);
  const inactiveFavorite = await owner.rpc("set_provider_favorite", {
    target_provider_slug: "runtime-discovery-" + runId,
    should_favorite: true,
  });
  assert(inactiveFavorite.error, "Inactive provider could still be favorited.");
  await admin
    .from("provider_profiles")
    .update({ status: "ACTIVE" })
    .eq("user_id", users.owner.id);
  const anonymousFavorite = await anonymous.rpc("set_provider_favorite", {
    target_provider_slug: "runtime-discovery-" + runId,
    should_favorite: true,
  });
  assert(anonymousFavorite.error, "Anonymous user could mutate favorites.");

  console.log("Phase 03 discovery runtime security checks: PASS");
} finally {
  for (const id of areaIds)
    await admin.from("service_areas").delete().eq("id", id);
  for (const id of serviceIds)
    await admin.from("services").delete().eq("id", id);
  for (const user of [users.owner, users.other, users.coverage]) {
    if (user.id) await admin.auth.admin.deleteUser(user.id);
  }
}

"use server";

import {
  availabilityBlockSchema,
  availabilityRuleSchema,
  certificationSchema,
  educationSchema,
  experienceSchema,
  portfolioSchema,
  providerMarketplaceSettingsSchema,
  serviceAreaSchema,
  serviceSchema,
} from "@changas/validation";
import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

const certificationBucket = "provider-certification-evidence";
const portfolioBucket = "provider-portfolio";
const certificationMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);
const portfolioMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function textOrNull(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requiredNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function checkbox(formData: FormData, name: string): boolean {
  return getFormString(formData, name) === "on";
}

function errorState(message = "No pudimos guardar los cambios."): ActionState {
  return { error: message };
}

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, provider: null };

  const { data: provider, error } = await supabase
    .from("provider_profiles")
    .select("user_id, status, marketplace_paused, availability_paused")
    .eq("user_id", user.id)
    .maybeSingle();

  return { supabase, user, provider: error ? null : provider };
}

function revalidateMarketplace(slug?: string | null) {
  revalidatePath("/provider/manage");
  if (slug) revalidatePath(`/p/${slug}`);
}

export async function updateMarketplaceSettings(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = providerMarketplaceSettingsSchema.safeParse({
    publicSlug: getFormString(formData, "publicSlug"),
    publicHeadline: getFormString(formData, "publicHeadline"),
    marketplacePaused: checkbox(formData, "marketplacePaused"),
    availabilityPaused: checkbox(formData, "availabilityPaused"),
  });
  if (!parsed.success) return errorState("Revisá el slug y el texto público.");

  const { supabase, user, provider } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  if (!provider) return errorState("Primero iniciá tu perfil de proveedor.");

  const { error } = await supabase
    .from("provider_profiles")
    .update({
      public_slug: parsed.data.publicSlug,
      public_headline: textOrNull(parsed.data.publicHeadline),
      marketplace_paused: parsed.data.marketplacePaused,
      availability_paused: parsed.data.availabilityPaused,
    })
    .eq("user_id", user.id);

  if (error) return errorState("No pudimos guardar la configuración pública.");
  revalidateMarketplace(parsed.data.publicSlug);
  return { success: "Configuración pública guardada." };
}

export async function saveProviderSkill(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const skillId = getFormString(formData, "skillId");
  if (!skillId) return errorState("Elegí una habilidad del catálogo.");
  const { supabase, user, provider } = await getContext();
  if (!user || !provider)
    return errorState("Prepará primero tu perfil de proveedor.");

  const { error } = await supabase.from("provider_skills").upsert(
    {
      provider_user_id: user.id,
      skill_id: skillId,
      is_featured: checkbox(formData, "isFeatured"),
      sort_order: requiredNumber(getFormString(formData, "sortOrder")) || 0,
    },
    { onConflict: "provider_user_id,skill_id" },
  );
  if (error) return errorState("No pudimos guardar la habilidad.");
  revalidateMarketplace();
  return { success: "Habilidad agregada a tu perfil." };
}

export async function removeProviderSkill(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const skillId =
    getFormString(formData, "skillId") || getFormString(formData, "recordId");
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const { error } = await supabase
    .from("provider_skills")
    .delete()
    .eq("provider_user_id", user.id)
    .eq("skill_id", skillId);
  if (error) return errorState("No pudimos quitar la habilidad.");
  revalidateMarketplace();
  return { success: "Habilidad quitada." };
}

function serviceInput(formData: FormData) {
  return {
    skillId: getFormString(formData, "skillId"),
    title: getFormString(formData, "title"),
    description: getFormString(formData, "description"),
    modality: getFormString(formData, "modality"),
    priceModel: getFormString(formData, "priceModel"),
    priceAmount:
      getFormString(formData, "priceModel") === "QUOTE"
        ? undefined
        : optionalNumber(getFormString(formData, "priceAmount")),
    currencyCode: getFormString(formData, "currencyCode") || "ARS",
    priceUnit: getFormString(formData, "priceUnit"),
    acceptsOffers: checkbox(formData, "acceptsOffers"),
    expectedDurationMinutes: optionalNumber(
      getFormString(formData, "expectedDurationMinutes"),
    ),
    scheduleType: getFormString(formData, "scheduleType"),
    includes: getFormString(formData, "includes"),
    excludes: getFormString(formData, "excludes"),
    materialsNotes: getFormString(formData, "materialsNotes"),
    isPublished: checkbox(formData, "isPublished"),
    isPaused: checkbox(formData, "isPaused"),
  };
}

export async function saveService(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = serviceSchema.safeParse(serviceInput(formData));
  if (!parsed.success)
    return errorState("Revisá título, descripción y precio.");
  const { supabase, user, provider } = await getContext();
  if (!user || !provider)
    return errorState("Prepará primero tu perfil de proveedor.");

  const serviceId = getFormString(formData, "serviceId");
  const payload = {
    skill_id: parsed.data.skillId,
    title: parsed.data.title,
    description: parsed.data.description,
    modality: parsed.data.modality,
    price_model: parsed.data.priceModel,
    price_amount: parsed.data.priceAmount ?? null,
    currency_code: parsed.data.currencyCode,
    price_unit: textOrNull(parsed.data.priceUnit),
    accepts_offers: parsed.data.acceptsOffers,
    expected_duration_minutes: parsed.data.expectedDurationMinutes ?? null,
    schedule_type: parsed.data.scheduleType,
    includes: textOrNull(parsed.data.includes),
    excludes: textOrNull(parsed.data.excludes),
    materials_notes: textOrNull(parsed.data.materialsNotes),
    is_published: parsed.data.isPublished,
    is_paused: parsed.data.isPaused,
    sort_order: 0,
  };
  const result = serviceId
    ? await supabase
        .from("services")
        .update(payload)
        .eq("id", serviceId)
        .eq("provider_user_id", user.id)
        .select("public_slug")
        .maybeSingle()
    : await supabase
        .from("services")
        .insert({ ...payload, provider_user_id: user.id })
        .select("public_slug")
        .single();

  if (result.error) {
    return errorState(
      parsed.data.isPublished
        ? "No se puede publicar hasta estar ACTIVE y sin pausas."
        : "No pudimos guardar el servicio.",
    );
  }
  revalidateMarketplace();
  return { success: "Servicio guardado." };
}

export async function toggleServicePause(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const serviceId = getFormString(formData, "serviceId");
  const paused = getFormString(formData, "paused") === "true";
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const { error } = await supabase
    .from("services")
    .update({ is_paused: paused })
    .eq("id", serviceId)
    .eq("provider_user_id", user.id);
  if (error) return errorState("No pudimos cambiar la pausa del servicio.");
  revalidateMarketplace();
  return { success: paused ? "Servicio pausado." : "Servicio reactivado." };
}

export async function deleteService(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", getFormString(formData, "serviceId"))
    .eq("provider_user_id", user.id);
  if (error) return errorState("No pudimos eliminar el servicio.");
  revalidateMarketplace();
  return { success: "Servicio eliminado." };
}

function experienceInput(formData: FormData) {
  return {
    title: getFormString(formData, "title"),
    organization: getFormString(formData, "organization"),
    description: getFormString(formData, "description"),
    startedOn: getFormString(formData, "startedOn"),
    endedOn: getFormString(formData, "endedOn") || undefined,
    isCurrent: checkbox(formData, "isCurrent"),
    isPublic: checkbox(formData, "isPublic"),
    sortOrder: requiredNumber(getFormString(formData, "sortOrder")) || 0,
  };
}

export async function saveExperience(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = experienceSchema.safeParse(experienceInput(formData));
  if (!parsed.success) return errorState("Revisá los datos de experiencia.");
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const payload = {
    title: parsed.data.title,
    organization: textOrNull(parsed.data.organization),
    description: textOrNull(parsed.data.description),
    started_on: parsed.data.startedOn,
    ended_on: parsed.data.endedOn ?? null,
    is_current: parsed.data.isCurrent,
    is_public: parsed.data.isPublic,
    sort_order: parsed.data.sortOrder,
  };
  const id = getFormString(formData, "recordId");
  const result = id
    ? await supabase
        .from("experiences")
        .update(payload)
        .eq("id", id)
        .eq("provider_user_id", user.id)
    : await supabase
        .from("experiences")
        .insert({ ...payload, provider_user_id: user.id });
  if (result.error) return errorState("No pudimos guardar la experiencia.");
  revalidateMarketplace();
  return { success: "Experiencia guardada." };
}

export async function deleteExperience(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return deleteOwnedRecord("experiences", getFormString(formData, "recordId"));
}

function educationInput(formData: FormData) {
  return {
    institution: getFormString(formData, "institution"),
    fieldOfStudy: getFormString(formData, "fieldOfStudy"),
    description: getFormString(formData, "description"),
    startedOn: getFormString(formData, "startedOn"),
    endedOn: getFormString(formData, "endedOn") || undefined,
    isPublic: checkbox(formData, "isPublic"),
    sortOrder: requiredNumber(getFormString(formData, "sortOrder")) || 0,
  };
}

export async function saveEducation(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = educationSchema.safeParse(educationInput(formData));
  if (!parsed.success) return errorState("Revisá los datos de formación.");
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const payload = {
    institution: parsed.data.institution,
    field_of_study: textOrNull(parsed.data.fieldOfStudy),
    description: textOrNull(parsed.data.description),
    started_on: parsed.data.startedOn,
    ended_on: parsed.data.endedOn ?? null,
    is_public: parsed.data.isPublic,
    sort_order: parsed.data.sortOrder,
  };
  const id = getFormString(formData, "recordId");
  const result = id
    ? await supabase
        .from("education")
        .update(payload)
        .eq("id", id)
        .eq("provider_user_id", user.id)
    : await supabase
        .from("education")
        .insert({ ...payload, provider_user_id: user.id });
  if (result.error) return errorState("No pudimos guardar la formación.");
  revalidateMarketplace();
  return { success: "Formación guardada." };
}

export async function deleteEducation(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return deleteOwnedRecord("education", getFormString(formData, "recordId"));
}

async function getOwnedCertification(id: string, userId: string) {
  const supabase = await createClient();
  const result = await supabase
    .from("certifications")
    .select("*")
    .eq("id", id)
    .eq("provider_user_id", userId)
    .maybeSingle();
  return { supabase, record: result.data, error: result.error };
}

async function getOwnedPortfolio(id: string, userId: string) {
  const supabase = await createClient();
  const result = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("id", id)
    .eq("provider_user_id", userId)
    .maybeSingle();
  return { supabase, record: result.data, error: result.error };
}

export async function saveCertification(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = certificationSchema.safeParse({
    title: getFormString(formData, "title"),
    issuer: getFormString(formData, "issuer"),
    description: getFormString(formData, "description"),
    issuedOn: getFormString(formData, "issuedOn") || undefined,
    expiresOn: getFormString(formData, "expiresOn") || undefined,
    isPublic: checkbox(formData, "isPublic"),
    sortOrder: requiredNumber(getFormString(formData, "sortOrder")) || 0,
  });
  if (!parsed.success)
    return errorState("Revisá los datos de la certificación.");
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const id = getFormString(formData, "recordId");
  const existing = id ? await getOwnedCertification(id, user.id) : null;
  if (existing?.error) return errorState("No pudimos leer la certificación.");
  const fileValue = formData.get("evidence");
  const hasFile = fileValue instanceof File && fileValue.size > 0;
  if (
    hasFile &&
    (!certificationMimeTypes.has(fileValue.type) ||
      fileValue.size > 10 * 1024 * 1024)
  ) {
    return errorState("La evidencia debe ser JPG, PNG o PDF de hasta 10 MiB.");
  }
  let evidencePath = existing?.record?.evidence_path ?? null;
  let evidenceMimeType = existing?.record?.evidence_mime_type ?? null;
  let evidenceSize = existing?.record?.evidence_file_size_bytes ?? null;
  let uploadedPath: string | null = null;
  if (hasFile) {
    const safeName =
      fileValue.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "evidence";
    uploadedPath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage
      .from(certificationBucket)
      .upload(uploadedPath, fileValue, {
        contentType: fileValue.type,
        upsert: false,
      });
    if (upload.error)
      return errorState("No pudimos subir la evidencia privada.");
    evidencePath = uploadedPath;
    evidenceMimeType = fileValue.type;
    evidenceSize = fileValue.size;
  }
  const payload = {
    title: parsed.data.title,
    issuer: textOrNull(parsed.data.issuer),
    description: textOrNull(parsed.data.description),
    issued_on: parsed.data.issuedOn ?? null,
    expires_on: parsed.data.expiresOn ?? null,
    is_public: parsed.data.isPublic,
    sort_order: parsed.data.sortOrder,
    evidence_path: evidencePath,
    evidence_mime_type: evidenceMimeType,
    evidence_file_size_bytes: evidenceSize,
  };
  const result = id
    ? await supabase
        .from("certifications")
        .update(payload)
        .eq("id", id)
        .eq("provider_user_id", user.id)
    : await supabase
        .from("certifications")
        .insert({ ...payload, provider_user_id: user.id });
  if (result.error) {
    if (uploadedPath)
      await supabase.storage.from(certificationBucket).remove([uploadedPath]);
    return errorState("No pudimos guardar la certificación.");
  }
  if (
    uploadedPath &&
    existing?.record?.evidence_path &&
    existing.record.evidence_path !== uploadedPath
  ) {
    await supabase.storage
      .from(certificationBucket)
      .remove([existing.record.evidence_path]);
  }
  revalidateMarketplace();
  return { success: "Certificación guardada. La evidencia permanece privada." };
}

export async function deleteCertification(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const id = getFormString(formData, "recordId");
  const existing = await getOwnedCertification(id, user.id);
  if (existing.error) return errorState("No pudimos leer la certificación.");
  const { error } = await supabase
    .from("certifications")
    .delete()
    .eq("id", id)
    .eq("provider_user_id", user.id);
  if (error) return errorState("No pudimos eliminar la certificación.");
  if (existing.record?.evidence_path) {
    await supabase.storage
      .from(certificationBucket)
      .remove([existing.record.evidence_path]);
  }
  revalidateMarketplace();
  return { success: "Certificación eliminada." };
}

export async function savePortfolioItem(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = portfolioSchema.safeParse({
    title: getFormString(formData, "title"),
    description: getFormString(formData, "description"),
    isPublic: checkbox(formData, "isPublic"),
    sortOrder: requiredNumber(getFormString(formData, "sortOrder")) || 0,
  });
  if (!parsed.success) return errorState("Revisá los datos del portfolio.");
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const id = getFormString(formData, "recordId");
  const existing = id ? await getOwnedPortfolio(id, user.id) : null;
  if (existing?.error)
    return errorState("No pudimos leer el elemento del portfolio.");
  const fileValue = formData.get("media");
  const hasFile = fileValue instanceof File && fileValue.size > 0;
  if (
    hasFile &&
    (!portfolioMimeTypes.has(fileValue.type) ||
      fileValue.size > 5 * 1024 * 1024)
  ) {
    return errorState("La imagen debe ser JPG, PNG o WebP de hasta 5 MiB.");
  }
  if (!parsed.data.isPublic && (hasFile || existing?.record?.media_path)) {
    return errorState(
      "La media de portfolio sólo se guarda si el elemento es público.",
    );
  }
  let mediaPath = existing?.record?.media_path ?? null;
  let mediaMimeType = existing?.record?.media_mime_type ?? null;
  let mediaSize = existing?.record?.media_file_size_bytes ?? null;
  let uploadedPath: string | null = null;
  if (hasFile) {
    const safeName =
      fileValue.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "portfolio";
    uploadedPath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage
      .from(portfolioBucket)
      .upload(uploadedPath, fileValue, {
        contentType: fileValue.type,
        upsert: false,
      });
    if (upload.error)
      return errorState("No pudimos subir la imagen del portfolio.");
    mediaPath = uploadedPath;
    mediaMimeType = fileValue.type;
    mediaSize = fileValue.size;
  }
  const payload = {
    title: parsed.data.title,
    description: textOrNull(parsed.data.description),
    is_public: parsed.data.isPublic,
    sort_order: parsed.data.sortOrder,
    media_path: mediaPath,
    media_mime_type: mediaMimeType,
    media_file_size_bytes: mediaSize,
  };
  const result = id
    ? await supabase
        .from("portfolio_items")
        .update(payload)
        .eq("id", id)
        .eq("provider_user_id", user.id)
    : await supabase
        .from("portfolio_items")
        .insert({ ...payload, provider_user_id: user.id });
  if (result.error) {
    if (uploadedPath)
      await supabase.storage.from(portfolioBucket).remove([uploadedPath]);
    return errorState("No pudimos guardar el elemento del portfolio.");
  }
  if (
    uploadedPath &&
    existing?.record?.media_path &&
    existing.record.media_path !== uploadedPath
  ) {
    await supabase.storage
      .from(portfolioBucket)
      .remove([existing.record.media_path]);
  }
  revalidateMarketplace();
  return { success: "Portfolio guardado." };
}

export async function deletePortfolioItem(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const id = getFormString(formData, "recordId");
  const existing = await getOwnedPortfolio(id, user.id);
  if (existing.error) return errorState("No pudimos leer el portfolio.");
  const { error } = await supabase
    .from("portfolio_items")
    .delete()
    .eq("id", id)
    .eq("provider_user_id", user.id);
  if (error) return errorState("No pudimos eliminar el portfolio.");
  if (existing.record?.media_path)
    await supabase.storage
      .from(portfolioBucket)
      .remove([existing.record.media_path]);
  revalidateMarketplace();
  return { success: "Elemento de portfolio eliminado." };
}

export async function saveServiceArea(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = serviceAreaSchema.safeParse({
    label: getFormString(formData, "label"),
    radiusMeters: requiredNumber(getFormString(formData, "radiusMeters")),
    latitude: requiredNumber(getFormString(formData, "latitude")),
    longitude: requiredNumber(getFormString(formData, "longitude")),
    isActive: checkbox(formData, "isActive"),
  });
  if (!parsed.success) return errorState("Revisá la zona y el radio.");
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const payload = {
    label: parsed.data.label,
    center: {
      type: "Point",
      coordinates: [parsed.data.longitude, parsed.data.latitude],
    },
    radius_meters: parsed.data.radiusMeters,
    is_active: parsed.data.isActive,
  };
  const id = getFormString(formData, "recordId");
  const result = id
    ? await supabase
        .from("service_areas")
        .update(payload)
        .eq("id", id)
        .eq("provider_user_id", user.id)
    : await supabase
        .from("service_areas")
        .insert({ ...payload, provider_user_id: user.id });
  if (result.error) return errorState("No pudimos guardar la zona.");
  revalidateMarketplace();
  return { success: "Zona de servicio guardada." };
}

export async function deleteServiceArea(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return deleteOwnedRecord(
    "service_areas",
    getFormString(formData, "recordId"),
  );
}

export async function saveAvailabilityRule(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = availabilityRuleSchema.safeParse({
    weekday: requiredNumber(getFormString(formData, "weekday")),
    startTime: getFormString(formData, "startTime"),
    endTime: getFormString(formData, "endTime"),
    timezone: getFormString(formData, "timezone"),
    isActive: checkbox(formData, "isActive"),
  });
  if (!parsed.success) return errorState("Revisá el horario disponible.");
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const payload = {
    weekday: parsed.data.weekday,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    timezone: parsed.data.timezone,
    is_active: parsed.data.isActive,
  };
  const id = getFormString(formData, "recordId");
  const result = id
    ? await supabase
        .from("availability_rules")
        .update(payload)
        .eq("id", id)
        .eq("provider_user_id", user.id)
    : await supabase
        .from("availability_rules")
        .insert({ ...payload, provider_user_id: user.id });
  if (result.error) return errorState("No pudimos guardar el horario.");
  revalidateMarketplace();
  return { success: "Horario guardado." };
}

export async function deleteAvailabilityRule(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return deleteOwnedRecord(
    "availability_rules",
    getFormString(formData, "recordId"),
  );
}

export async function saveAvailabilityBlock(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = availabilityBlockSchema.safeParse({
    startsAt: getFormString(formData, "startsAt"),
    endsAt: getFormString(formData, "endsAt"),
    reason: getFormString(formData, "reason"),
  });
  if (!parsed.success)
    return errorState("Revisá el bloqueo de disponibilidad.");
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const payload = {
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    reason: textOrNull(parsed.data.reason),
  };
  const id = getFormString(formData, "recordId");
  const result = id
    ? await supabase
        .from("availability_blocks")
        .update(payload)
        .eq("id", id)
        .eq("provider_user_id", user.id)
    : await supabase
        .from("availability_blocks")
        .insert({ ...payload, provider_user_id: user.id });
  if (result.error) return errorState("No pudimos guardar el bloqueo.");
  revalidateMarketplace();
  return { success: "Bloqueo guardado." };
}

export async function deleteAvailabilityBlock(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return deleteOwnedRecord(
    "availability_blocks",
    getFormString(formData, "recordId"),
  );
}

type OwnedTable =
  | "experiences"
  | "education"
  | "service_areas"
  | "availability_rules"
  | "availability_blocks";

async function deleteOwnedRecord(
  table: OwnedTable,
  id: string,
): Promise<ActionState> {
  const { supabase, user } = await getContext();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("provider_user_id", user.id);
  if (error) return errorState("No pudimos eliminar el registro.");
  revalidateMarketplace();
  return { success: "Registro eliminado." };
}

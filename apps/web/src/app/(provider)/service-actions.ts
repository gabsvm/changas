"use server";

import { parseServicePrice, type PriceModel } from "@changas/domain";
import { serviceSchema, serviceTagsSchema } from "@changas/validation";
import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

function checkbox(formData: FormData, name: string): boolean {
  return getFormString(formData, name) === "on";
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function textOrNull(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}

function errorState(message: string): ActionState {
  return { error: message };
}

function serviceInput(formData: FormData, priceAmount?: number) {
  return {
    skillId: getFormString(formData, "skillId"),
    title: getFormString(formData, "title"),
    description: getFormString(formData, "description"),
    modality: getFormString(formData, "modality"),
    priceModel: getFormString(formData, "priceModel"),
    priceAmount,
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

export async function saveServiceTransactional(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const priceModel = getFormString(formData, "priceModel");
  const currencyCode = getFormString(formData, "currencyCode") || "ARS";
  let priceAmount: number | null;
  try {
    priceAmount = parseServicePrice(
      priceModel as PriceModel,
      getFormString(formData, "priceAmount"),
      currencyCode,
    );
  } catch {
    return errorState(
      "El monto debe ser positivo, válido y estar expresado en ARS.",
    );
  }

  const parsed = serviceSchema.safeParse(
    serviceInput(formData, priceAmount ?? undefined),
  );
  if (!parsed.success) {
    return errorState("Revisá título, descripción y precio.");
  }

  const parsedTags = serviceTagsSchema.safeParse(
    getFormString(formData, "tags")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  );
  if (!parsedTags.success) {
    return errorState(
      "Usá hasta ocho tags únicos de entre 2 y 80 caracteres, separados por comas.",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorState("Tu sesión expiró. Volvé a iniciar sesión.");

  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!provider) return errorState("Prepará primero tu perfil de proveedor.");

  const { data, error } = await supabase.rpc("save_service_with_tags", {
    target_service_id: getFormString(formData, "serviceId") || null,
    requested_skill_id: parsed.data.skillId,
    requested_title: parsed.data.title,
    requested_description: parsed.data.description,
    requested_modality: parsed.data.modality,
    requested_price_model: parsed.data.priceModel,
    requested_price_amount: parsed.data.priceAmount ?? null,
    requested_currency_code: parsed.data.currencyCode,
    requested_price_unit: textOrNull(parsed.data.priceUnit),
    requested_accepts_offers: parsed.data.acceptsOffers,
    requested_expected_duration_minutes:
      parsed.data.expectedDurationMinutes ?? null,
    requested_schedule_type: parsed.data.scheduleType,
    requested_includes: textOrNull(parsed.data.includes),
    requested_excludes: textOrNull(parsed.data.excludes),
    requested_materials_notes: textOrNull(parsed.data.materialsNotes),
    requested_is_published: parsed.data.isPublished,
    requested_is_paused: parsed.data.isPaused,
    requested_tags: parsedTags.data,
  });

  if (error || !data?.length) {
    return errorState(
      parsed.data.isPublished
        ? "No se pudo publicar el servicio. Revisá que tu perfil esté ACTIVE, sin pausas y que la habilidad siga seleccionada."
        : "No pudimos guardar el servicio y sus tags.",
    );
  }

  revalidatePath("/provider/manage");
  return { success: "Servicio y tags guardados." };
}

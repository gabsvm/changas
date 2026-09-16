"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import {
  parseServiceForm,
  type ServiceFormRaw,
} from "@/lib/provider/service-input";
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

function serviceRaw(formData: FormData): ServiceFormRaw {
  return {
    skillId: getFormString(formData, "skillId"),
    title: getFormString(formData, "title"),
    description: getFormString(formData, "description"),
    modality: getFormString(formData, "modality"),
    priceModel: getFormString(formData, "priceModel"),
    priceAmount: getFormString(formData, "priceAmount"),
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
    tags: getFormString(formData, "tags")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

type SaveServiceRpcArgs = {
  target_service_id: string | null;
  requested_skill_id: string;
  requested_title: string;
  requested_description: string;
  requested_modality: "IN_PERSON" | "REMOTE" | "BOTH";
  requested_price_model:
    "FIXED" | "STARTING_AT" | "HOURLY" | "PER_UNIT" | "QUOTE";
  requested_price_amount: number | null;
  requested_currency_code: "ARS";
  requested_price_unit: string | null;
  requested_accepts_offers: boolean;
  requested_expected_duration_minutes: number | null;
  requested_schedule_type:
    "FIXED_SLOT" | "FLEXIBLE_WINDOW" | "DEADLINE" | "UNSCHEDULED";
  requested_includes: string | null;
  requested_excludes: string | null;
  requested_materials_notes: string | null;
  requested_is_published: boolean;
  requested_is_paused: boolean;
  requested_tags: string[];
};

type SaveServiceRpcResult = {
  data: Array<{ id: string; public_slug: string }> | null;
  error: { message: string } | null;
};

export async function saveServiceTransactional(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsedForm = parseServiceForm(serviceRaw(formData));
  if (!parsedForm.ok) {
    return errorState(parsedForm.message);
  }
  const { data: parsed, tags: parsedTags } = parsedForm;

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

  const args: SaveServiceRpcArgs = {
    target_service_id: getFormString(formData, "serviceId") || null,
    requested_skill_id: parsed.skillId,
    requested_title: parsed.title,
    requested_description: parsed.description,
    requested_modality: parsed.modality,
    requested_price_model: parsed.priceModel,
    requested_price_amount: parsed.priceAmount ?? null,
    requested_currency_code: parsed.currencyCode,
    requested_price_unit: textOrNull(parsed.priceUnit),
    requested_accepts_offers: parsed.acceptsOffers,
    requested_expected_duration_minutes:
      parsed.expectedDurationMinutes ?? null,
    requested_schedule_type: parsed.scheduleType,
    requested_includes: textOrNull(parsed.includes),
    requested_excludes: textOrNull(parsed.excludes),
    requested_materials_notes: textOrNull(parsed.materialsNotes),
    requested_is_published: parsed.isPublished,
    requested_is_paused: parsed.isPaused,
    requested_tags: parsedTags,
  };

  const rpc = supabase.rpc as unknown as (
    functionName: "save_service_with_tags",
    rpcArgs: SaveServiceRpcArgs,
  ) => Promise<SaveServiceRpcResult>;
  const { data, error } = await rpc("save_service_with_tags", args);

  if (error || !data?.length) {
    return errorState(
      parsed.isPublished
        ? "No se pudo publicar el servicio. Revisá que tu perfil esté ACTIVE, sin pausas y que la habilidad siga seleccionada."
        : "No pudimos guardar el servicio y sus tags.",
    );
  }

  revalidatePath("/provider/manage");
  return { success: "Servicio y tags guardados." };
}

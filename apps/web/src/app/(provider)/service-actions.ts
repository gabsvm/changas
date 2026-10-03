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
  error: { message: string; code?: string | null } | null;
};

function saveServiceErrorMessage(
  error: SaveServiceRpcResult["error"],
  isPublished: boolean,
): string {
  const message = error?.message ?? "";
  if (message.includes("only an active, unpaused provider can publish")) {
    return "No se puede publicar hasta que tu perfil esté ACTIVE y sin pausas. Podés guardarlo sin publicar.";
  }
  switch (error?.code) {
    case "42501":
      return "Tu sesión expiró o este servicio no es tuyo. Volvé a iniciar sesión.";
    case "23503":
      return "La habilidad elegida ya no está en tu perfil. Agregala de nuevo arriba.";
    case "23505":
      return "Ya tenés un servicio con ese título. Probá con otro.";
    case "23514":
      return "Revisá los datos: algún campo no cumple las reglas del servicio.";
  }
  return isPublished
    ? "No pudimos publicar el servicio. Probá de nuevo en unos minutos."
    : "No pudimos guardar el servicio y sus tags. Probá de nuevo en unos minutos.";
}

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

  // Offering a service in a skill implies having that skill on the profile.
  const { error: skillError } = await supabase.from("provider_skills").upsert(
    {
      provider_user_id: user.id,
      skill_id: parsed.skillId,
      is_featured: false,
      sort_order: 0,
    },
    { onConflict: "provider_user_id,skill_id", ignoreDuplicates: true },
  );
  if (skillError) {
    return errorState(saveServiceErrorMessage(skillError, parsed.isPublished));
  }

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
    requested_expected_duration_minutes: parsed.expectedDurationMinutes ?? null,
    requested_schedule_type: parsed.scheduleType,
    requested_includes: textOrNull(parsed.includes),
    requested_excludes: textOrNull(parsed.excludes),
    requested_materials_notes: textOrNull(parsed.materialsNotes),
    requested_is_published: parsed.isPublished,
    requested_is_paused: parsed.isPaused,
    requested_tags: parsedTags,
  };

  // Bind: supabase-js `rpc` reads `this.rest`, so a detached call throws.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    functionName: "save_service_with_tags",
    rpcArgs: SaveServiceRpcArgs,
  ) => Promise<SaveServiceRpcResult>;
  const { data, error } = await rpc("save_service_with_tags", args);

  if (error || !data?.length) {
    return errorState(saveServiceErrorMessage(error, parsed.isPublished));
  }

  revalidatePath("/provider/manage");
  return { success: "Servicio y tags guardados." };
}

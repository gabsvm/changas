"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

function errorMessage(message: string): string {
  if (message.includes("provider profile is required")) {
    return "Prepará primero tu perfil de proveedor.";
  }
  if (message.includes("category is not available")) {
    return "Esa categoría ya no está disponible. Elegí otra.";
  }
  if (message.includes("skill name must be")) {
    return "El nombre necesita entre 2 y 80 caracteres.";
  }
  if (message.includes("service title must be")) {
    return "El título del servicio necesita al menos 3 caracteres.";
  }
  if (message.includes("service description must be")) {
    return "La descripción del servicio necesita al menos 20 caracteres.";
  }
  return "No pudimos enviar la propuesta. Probá de nuevo en unos minutos.";
}

export async function submitSkillRequestAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const priceModel = getFormString(formData, "priceModel");
  if (
    !["FIXED", "STARTING_AT", "HOURLY", "PER_UNIT", "QUOTE"].includes(
      priceModel,
    )
  ) {
    return { error: "Elegí un modelo de precio válido." };
  }
  const modality = getFormString(formData, "modality");
  if (!["IN_PERSON", "REMOTE", "BOTH"].includes(modality)) {
    return { error: "Elegí una modalidad válida." };
  }
  const rawAmount = Number(getFormString(formData, "priceAmount"));
  const priceAmount =
    getFormString(formData, "priceAmount").trim() === ""
      ? null
      : Number.isSafeInteger(rawAmount) && rawAmount > 0
        ? rawAmount
        : null;

  const { data, error } = await supabase.rpc("submit_skill_request", {
    requested_name: getFormString(formData, "name"),
    requested_category_id: getFormString(formData, "categoryId") || null,
    requested_description: getFormString(formData, "description") || null,
    requested_service_title: getFormString(formData, "serviceTitle"),
    requested_service_description: getFormString(
      formData,
      "serviceDescription",
    ),
    requested_service_modality: modality,
    requested_service_price_model: priceModel,
    requested_service_price_amount: priceAmount,
    requested_service_price_unit: getFormString(formData, "priceUnit") || null,
  });

  if (error) return { error: errorMessage(error.message) };

  const row = (Array.isArray(data) ? data[0] : null) as {
    request_id: string | null;
    attached_skill_id: string | null;
  } | null;
  if (row?.attached_skill_id) {
    revalidatePath("/provider/manage");
    return {
      success:
        "Esa habilidad ya existe en el catálogo: la agregamos a tu perfil.",
    };
  }
  if (row?.request_id) {
    revalidatePath("/provider/manage");
    return {
      success:
        "Propuesta enviada. Te avisamos cuando la revisemos y tu servicio queda armado.",
    };
  }
  return { error: "No pudimos enviar la propuesta. Probá de nuevo." };
}

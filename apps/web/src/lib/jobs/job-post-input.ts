/**
 * Validacion cliente del wizard de necesidad abierta (camino B, YALO S2).
 * Reglas espejo del RPC `create_job_post`: titulo 10-120, descripcion
 * 20-4000, rubro obligatorio, ubicacion opcional 2-200, presupuesto
 * opcional positivo, ventana opcional con fin posterior al inicio.
 */

import { parseArsMinorUnits } from "@changas/validation";

import { parseProductDateTime } from "@/lib/product-time";

export type JobPostFormRaw = {
  skillId: string;
  title: string;
  description: string;
  locationText: string;
  scheduleStartAt: string;
  scheduleEndAt: string;
  desiredBudgetAmount: string;
};

export type JobPostParsedData = {
  skillId: string;
  title: string;
  description: string;
  locationText?: string | undefined;
  scheduleStartAt?: Date | undefined;
  scheduleEndAt?: Date | undefined;
  desiredBudgetAmount?: number | undefined;
};

export type ParsedJobPostForm =
  { ok: true; data: JobPostParsedData } | { ok: false; message: string };

function parseDateTime(raw: string): Date | undefined | null {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  return parseProductDateTime(trimmed);
}

export function parseJobPostForm(raw: JobPostFormRaw): ParsedJobPostForm {
  if (raw.skillId.trim() === "") {
    return {
      ok: false,
      message: "Elegí el rubro del catálogo para tu necesidad.",
    };
  }

  const title = raw.title.trim();
  if (title.length < 10 || title.length > 120) {
    return {
      ok: false,
      message: "El título necesita entre 10 y 120 caracteres.",
    };
  }

  const description = raw.description.trim();
  if (description.length < 20 || description.length > 4000) {
    return {
      ok: false,
      message:
        "La descripción necesita al menos 20 caracteres para que los prestadores entiendan el trabajo.",
    };
  }

  const locationText = raw.locationText.trim();
  if (
    locationText !== "" &&
    (locationText.length < 2 || locationText.length > 200)
  ) {
    return {
      ok: false,
      message: "La ubicación admite entre 2 y 200 caracteres, o dejala vacía.",
    };
  }

  const desiredBudgetAmount = parseArsMinorUnits(raw.desiredBudgetAmount);
  if (
    raw.desiredBudgetAmount.trim() !== "" &&
    desiredBudgetAmount === undefined
  ) {
    return {
      ok: false,
      message:
        "El presupuesto debe ser un monto positivo en ARS (podés usar coma decimal).",
    };
  }

  const scheduleStartAt = parseDateTime(raw.scheduleStartAt);
  if (scheduleStartAt === null) {
    return {
      ok: false,
      message: "La fecha de inicio no es válida.",
    };
  }
  const scheduleEndAt = parseDateTime(raw.scheduleEndAt);
  if (scheduleEndAt === null) {
    return {
      ok: false,
      message: "La fecha de fin no es válida.",
    };
  }
  if (
    scheduleStartAt !== undefined &&
    scheduleEndAt !== undefined &&
    scheduleEndAt <= scheduleStartAt
  ) {
    return {
      ok: false,
      message: "La fecha de fin tiene que ser posterior al inicio.",
    };
  }

  return {
    ok: true,
    data: {
      skillId: raw.skillId.trim(),
      title,
      description,
      locationText: locationText === "" ? undefined : locationText,
      scheduleStartAt,
      scheduleEndAt,
      desiredBudgetAmount,
    },
  };
}

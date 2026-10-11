import { describe, expect, it } from "vitest";

import { resolveJobReturnHref } from "./return-href";

const JOB_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("resolveJobReturnHref", () => {
  it("vuelve al Seguimiento cuando Mercado Pago devuelve el job", () => {
    expect(resolveJobReturnHref(JOB_ID)).toBe(`/jobs/${JOB_ID}`);
    expect(resolveJobReturnHref([JOB_ID])).toBe(`/jobs/${JOB_ID}`);
  });

  it("cae a la lista si el parámetro falta o no es un job válido", () => {
    expect(resolveJobReturnHref(undefined)).toBe("/jobs");
    expect(resolveJobReturnHref("../../../account")).toBe("/jobs");
    expect(resolveJobReturnHref("")).toBe("/jobs");
  });
});

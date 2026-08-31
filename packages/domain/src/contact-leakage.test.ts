import { describe, expect, it } from "vitest";

import { detectContactLeakage } from "./contact-leakage";

function types(text: string) {
  return detectContactLeakage(text).map((signal) => signal.type);
}

describe("detectContactLeakage", () => {
  it("detects obvious phone and email contact leakage", () => {
    expect(types("Escribime al +54 9 11 5555-1234")).toContain("PHONE");
    expect(types("mi mail es persona@example.com")).toContain("EMAIL");
  });

  it("detects explicit off-platform contact requests", () => {
    expect(types("te paso mi whatsapp y coordinamos por ahí")).toContain(
      "EXTERNAL_CONTACT_REQUEST",
    );
    expect(types("mandame un mensaje por Telegram")).toContain(
      "EXTERNAL_CONTACT_REQUEST",
    );
  });

  it("detects obvious payment handles and off-platform payment requests", () => {
    expect(types("pagame por mercado pago al alias juan.servicios")).toContain(
      "PAYMENT_HANDLE",
    );
    expect(types("mi CBU es 2850590940090418135201")).toContain(
      "PAYMENT_HANDLE",
    );
  });

  it("does not broadly flag normal service numbers, dimensions, prices or dates", () => {
    for (const text of [
      "Instalo Windows 11 y Office",
      "La tabla mide 120 x 60 cm",
      "El trabajo cuesta $45.000",
      "Puedo ir el 12/09/2026",
      "Necesito 3 tornillos de 10 mm",
    ]) {
      expect(detectContactLeakage(text), text).toEqual([]);
    }
  });
});

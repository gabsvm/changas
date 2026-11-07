import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("Secciones con sesión — auditoría de placing 2026-11-07", () => {
  describe("/account", () => {
    const account = read("../../app/(account)/account/page.tsx");

    it("muestra primero el trabajo en curso", () => {
      expect(account).toContain("listMyUpcomingJobs(5)");
      expect(account.indexOf("account-active-job")).toBeLessThan(
        account.indexOf("getProviderNextAction({"),
      );
    });

    it("no empuja el alta de prestador a quien no la empezó", () => {
      expect(account).toContain("if (!provider) return null;");
      expect(account).not.toContain("¿Querés ofrecer servicios?");
      expect(account).not.toContain("StartProviderForm");
      expect(account).toContain('title="Ofrecer mis servicios"');
    });

    it("da una acción visible para completar el perfil", () => {
      expect(account).toContain("Completar perfil");
    });
  });
});

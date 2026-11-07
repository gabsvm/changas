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
  describe("/messages/[id]", () => {
    const thread = read(
      "../../components/conversations/conversation-thread.tsx",
    );
    const page = read("../../app/(account)/messages/[conversationId]/page.tsx");
    const composer = read(
      "../../components/conversations/proposal-composer.tsx",
    );

    it("no ofrece contratar/cotizar cuando ya hay un trabajo", () => {
      expect(thread).toContain("{spotlight ? null : (");
      expect(thread).toMatch(/currentUserIsClient &&\s*!spotlight &&/);
    });

    it("deja un solo 'Ver seguimiento' y pasa 'Ayuda' al menú", () => {
      expect(page).not.toContain("Este chat tiene un servicio asociado.");
      expect(page).toContain("Trabajo ${spotlightStatus.label.toLowerCase()}");
      expect(thread).toContain("Ayuda con este servicio");
      expect(thread).not.toMatch(/>\s*Ayuda\s*</);
    });

    it("pliega las propuestas cuando hay trabajo y no repite la cotización", () => {
      expect(page).toContain("proposals.length > 0 && spotlightJob ?");
      expect(page).toContain(
        "openFromHeaderOnly={!currentUserIsClient || spotlightJob !== null}",
      );
      expect(composer).toContain("[&:not([open])]:hidden");
    });
  });
});

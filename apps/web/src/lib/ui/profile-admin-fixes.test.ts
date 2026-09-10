import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authSource = readFileSync(
  new URL("../../components/auth/auth-form.tsx", import.meta.url),
  "utf8",
);
const avatarSource = readFileSync(
  new URL(
    "../../components/account/profile-avatar-uploader.tsx",
    import.meta.url,
  ),
  "utf8",
);
const adminPageSource = readFileSync(
  new URL("../../app/admin/identity/page.tsx", import.meta.url),
  "utf8",
);
const serverConfigSource = readFileSync(
  new URL("../../../../../packages/config/src/server.ts", import.meta.url),
  "utf8",
);

describe("profile and admin regressions", () => {
  it("does not render a second lettermark inside the auth card", () => {
    expect(authSource).not.toContain("bg-brand-yellow/20");
  });

  it("keeps the Storage error available when an avatar upload fails", () => {
    expect(avatarSource).toContain("upload.error.message");
    expect(avatarSource).toContain("Bucket not found");
    expect(avatarSource).toContain("almacenamiento de fotos");
  });

  it("opens identity evidence through an in-app preview", () => {
    expect(adminPageSource).toContain("IdentityDocumentPreview");
    expect(adminPageSource).not.toContain('target="_blank"');
  });

  it("accepts the local Supabase service-role variable name server-side", () => {
    expect(serverConfigSource).toContain(
      "process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY",
    );
  });
});

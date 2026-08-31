import { expect, test } from "@playwright/test";

const apiUrl = process.env.API_URL;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

async function adminRequest(path: string, init: RequestInit = {}) {
  if (!apiUrl || !serviceRoleKey) {
    throw new Error("API_URL and SERVICE_ROLE_KEY are required for authenticated E2E");
  }
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
}

test.describe("Phase 02 mobile web smoke", () => {
  test("provider management requires an authenticated session", async ({
    page,
  }) => {
    await page.goto("/provider/manage");
    await expect(page).toHaveURL(
      /\/login\?next=(?:%2F|\/)provider(?:%2F|\/)manage$/,
    );
    await expect(
      page.getByRole("heading", { name: "Volvé a Changas" }),
    ).toBeVisible();
  });

  test("authenticated provider can open the real management surface", async ({
    page,
  }) => {
    const suffix = crypto.randomUUID();
    const email = `phase02-e2e-${suffix}@example.test`;
    const password = `Phase02-${suffix}-Password!`;
    let userId: string | null = null;

    try {
      const createUser = await adminRequest("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: "Proveedor E2E" },
        }),
      });
      expect(createUser.ok).toBeTruthy();
      const user = (await createUser.json()) as { id: string };
      userId = user.id;

      const createProvider = await adminRequest("/rest/v1/provider_profiles", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          status: "ACTIVE",
          onboarding_step: 4,
          public_slug: `e2e-${suffix}`,
          public_headline: "Proveedor sintético E2E",
        }),
      });
      expect(createProvider.ok).toBeTruthy();

      await page.goto("/login?next=/provider/manage");
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByLabel("Contraseña").fill(password);
      await page.getByRole("button", { name: "Iniciar sesión" }).click();

      await expect(page).toHaveURL(/\/provider\/manage$/);
      await expect(
        page.getByRole("heading", { name: /Tu marketplace, Proveedor E2E/ }),
      ).toBeVisible();
      await expect(page.getByText("Habilidades que ofrecés")).toBeVisible();
    } finally {
      if (userId) {
        await adminRequest(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
      }
    }
  });

  test("public provider page renders the seeded active provider without a fake badge", async ({
    page,
  }) => {
    await page.goto("/p/demo-proveedor");
    await expect(
      page.getByRole("heading", { name: "Demo Proveedor" }),
    ).toBeVisible();
    await expect(page.getByText("Proveedor verificado")).toHaveCount(0);
    await expect(page.getByText("Perfil activo")).toBeVisible();
  });

  test("public service page is isolated to the provider slug", async ({
    page,
  }) => {
    await page.goto("/p/demo-proveedor/demo-revision-pc");
    await expect(
      page.getByRole("heading", { name: "Revisión de PC a distancia" }),
    ).toBeVisible();
    await expect(page.getByText("$12.500")).toBeVisible();
  });
});

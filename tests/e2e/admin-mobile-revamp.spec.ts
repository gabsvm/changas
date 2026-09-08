import { expect, test, type Page } from "@playwright/test";

const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

type TestUser = { id: string; email: string; password: string };

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7j9sAAAAASUVORK5CYII=",
  "base64",
);

function requireAdminConfig() {
  if (!apiUrl || !serviceRoleKey) {
    throw new Error(
      "Admin mobile E2E requires local Supabase URL and service-role credentials.",
    );
  }
  return { apiUrl, serviceRoleKey };
}

async function adminRequest(path: string, init: RequestInit = {}) {
  const config = requireAdminConfig();
  return fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
}

async function createTestUser(label: string): Promise<TestUser> {
  const suffix = crypto.randomUUID();
  const email = `admin-mobile-${suffix}@example.test`;
  const password = `AdminMobile-${suffix}-Password!`;
  const response = await adminRequest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: label },
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Could not create admin-mobile E2E user: ${response.status} ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error("Admin-mobile E2E user response has no id.");
  return { id: body.id, email, password };
}

async function promoteAdmin(userId: string) {
  const response = await adminRequest(
    `/rest/v1/user_roles?user_id=eq.${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ role: "admin" }),
    },
  );
  expect(response.ok).toBeTruthy();
}

async function login(page: Page, user: TestUser, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(
    (url) => `${url.pathname}${url.search}` === next,
  );
}

async function providerStatus(userId: string) {
  const response = await adminRequest(
    `/rest/v1/provider_profiles?user_id=eq.${userId}&select=status,onboarding_step`,
  );
  expect(response.ok).toBeTruthy();
  const rows = (await response.json()) as Array<{
    status: string;
    onboarding_step: number;
  }>;
  return rows[0] ?? null;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function prepareProviderFixture(user: TestUser) {
  let response = await adminRequest("/rest/v1/provider_profiles", {
    method: "POST",
    body: JSON.stringify({
      user_id: user.id,
      status: "PROFILE_INCOMPLETE",
      onboarding_step: 3,
    }),
  });
  expect(response.ok).toBeTruthy();

  response = await adminRequest(`/rest/v1/profiles?id=eq.${user.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      display_name: "Prestador verificación E2E",
      public_zone: "CABA",
      bio: "Perfil sintético para validar el flujo completo de verificación de identidad.",
    }),
  });
  expect(response.ok).toBeTruthy();

  response = await adminRequest(
    `/rest/v1/profile_private?user_id=eq.${user.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        legal_name: "Prestador Verificación E2E",
        private_phone: "+54 11 5555 0101",
        date_of_birth: "1990-01-01",
        exact_address: "Dirección sintética 123, CABA",
        dni_number: "30111222",
      }),
    },
  );
  expect(response.ok).toBeTruthy();
}

async function uploadIdentityDocument(
  page: Page,
  documentType: "DNI_FRONT" | "DNI_BACK" | "SELFIE",
  expectedLabel: string,
) {
  await page.getByLabel("Tipo de documento").selectOption(documentType);
  await page.locator('input[name="document"]').setInputFiles({
    name: `${documentType.toLowerCase()}.png`,
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await page.getByRole("button", { name: "Subir documento privado" }).click();
  await expect(
    page.getByText(expectedLabel, { exact: true }).last(),
  ).toBeVisible();
}

test.describe("admin mobile revamp and provider operations", () => {
  test("admin shell is mobile-first at 320, 360 and 390 px", async ({
    page,
  }) => {
    const admin = await createTestUser("Admin Mobile Shell");
    await promoteAdmin(admin.id);
    await login(page, admin, "/admin");

    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/admin");
      await expect(
        page.getByRole("heading", { name: "Resumen" }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const nav = page.getByRole("navigation", {
        name: "Administración móvil",
      });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole("link", { name: "Resumen" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Identidad" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Usuarios" })).toBeVisible();

      for (const target of [
        nav.getByRole("link", { name: "Resumen" }),
        nav.getByRole("link", { name: "Identidad" }),
        nav.getByRole("link", { name: "Usuarios" }),
        nav.getByRole("button", { name: "Más" }),
      ]) {
        const box = await target.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
      }

      await nav.getByRole("button", { name: "Más" }).click();
      const sheet = page.getByRole("region", {
        name: "Más secciones administrativas",
      });
      await expect(sheet).toBeVisible();
      for (const label of [
        "Prestadores",
        "Catálogo",
        "Reportes",
        "Trabajos",
        "Pagos",
        "Auditoría",
      ]) {
        await expect(sheet.getByRole("link", { name: label })).toBeVisible();
      }
      await sheet.getByRole("button", { name: "Cerrar" }).click();
      await expect(sheet).toBeHidden();
    }
  });

  test("admin can prepare onboarding or perform an audited manual activation", async ({
    page,
  }) => {
    const admin = await createTestUser("Admin Provider Ops");
    const normalFlow = await createTestUser("Usuario Onboarding Normal");
    const manualFlow = await createTestUser("Usuario Activación Manual");
    await promoteAdmin(admin.id);
    await login(page, admin, `/admin/users?user=${normalFlow.id}`);

    await page
      .getByRole("button", { name: "Invitar a completar perfil" })
      .click();
    await expect(
      page.getByText("Perfil incompleto", { exact: true }).first(),
    ).toBeVisible();
    await expect
      .poll(() => providerStatus(normalFlow.id))
      .toMatchObject({
        status: "PROFILE_INCOMPLETE",
        onboarding_step: 1,
      });

    let auditResponse = await adminRequest(
      `/rest/v1/admin_audit_events?target_id=eq.${normalFlow.id}&action_type=eq.PROVIDER_ONBOARDING_PREPARED&select=action_type,metadata`,
    );
    expect(auditResponse.ok).toBeTruthy();
    let auditRows = (await auditResponse.json()) as Array<{
      action_type: string;
    }>;
    expect(auditRows).toHaveLength(1);

    await page.goto(`/admin/users?user=${manualFlow.id}`);
    await page.getByText("Activar manualmente", { exact: true }).click();
    const reason = "Socio verificado presencialmente para prueba E2E";
    await page
      .getByPlaceholder("Ej: socio fundador verificado presencialmente")
      .fill(reason);
    await page
      .getByRole("button", { name: "Confirmar activación manual" })
      .click();
    await expect(
      page.getByText("Activo", { exact: true }).first(),
    ).toBeVisible();
    await expect
      .poll(() => providerStatus(manualFlow.id))
      .toMatchObject({
        status: "ACTIVE",
        onboarding_step: 4,
      });

    auditResponse = await adminRequest(
      `/rest/v1/admin_audit_events?target_id=eq.${manualFlow.id}&action_type=eq.PROVIDER_MANUALLY_ACTIVATED&select=action_type,metadata`,
    );
    expect(auditResponse.ok).toBeTruthy();
    auditRows = (await auditResponse.json()) as Array<{
      action_type: string;
      metadata?: Record<string, unknown>;
    }>;
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.metadata).toMatchObject({
      reason,
      verification_bypassed: true,
      new_status: "ACTIVE",
    });
  });

  test("normal identity submission stays out of review until all three documents are present", async ({
    page,
  }) => {
    const provider = await createTestUser("Prestador Submission Truthful");
    await prepareProviderFixture(provider);
    await login(page, provider, "/provider/onboarding/documents");

    await uploadIdentityDocument(page, "DNI_FRONT", "DNI frente");
    await uploadIdentityDocument(page, "DNI_BACK", "DNI dorso");
    await expect(
      page.getByRole("button", { name: "Enviar a revisión" }),
    ).toBeDisabled();
    expect(await providerStatus(provider.id)).toMatchObject({
      status: "PROFILE_INCOMPLETE",
    });

    await uploadIdentityDocument(page, "SELFIE", "Selfie de validación");
    const submit = page.getByRole("button", { name: "Enviar a revisión" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page).toHaveURL("/provider/onboarding/review");
    await expect(
      page.getByText("En revisión", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Caso enviado correctamente", { exact: true }),
    ).toBeVisible();
    expect(await providerStatus(provider.id)).toMatchObject({
      status: "IDENTITY_PENDING",
      onboarding_step: 4,
    });
  });
});

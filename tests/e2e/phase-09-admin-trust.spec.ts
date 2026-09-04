import { expect, test, type Page } from "@playwright/test";

const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

type TestUser = { id: string; email: string; password: string };

function requireAdminConfig() {
  if (!apiUrl || !serviceRoleKey)
    throw new Error("Phase 09 E2E requires local Supabase admin credentials.");
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
  const email = `phase09-e2e-${suffix}@example.test`;
  const password = `Phase09-${suffix}-Password!`;
  const response = await adminRequest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: label },
    }),
  });
  if (!response.ok)
    throw new Error(
      `Could not create Phase 09 E2E user: ${response.status} ${await response.text()}`,
    );
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error("Phase 09 E2E user response has no id.");
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

async function login(page: Page, user: TestUser, next = "/admin") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(
    (url) => `${url.pathname}${url.search}` === next,
  );
}

async function createIdentityCase(provider: TestUser) {
  const slug = `phase09-identity-${crypto.randomUUID()}`.toLowerCase();
  const providerResponse = await adminRequest("/rest/v1/provider_profiles", {
    method: "POST",
    body: JSON.stringify({
      user_id: provider.id,
      status: "IDENTITY_PENDING",
      onboarding_step: 4,
      public_slug: slug,
    }),
  });
  expect(providerResponse.ok).toBeTruthy();

  const path = `${provider.id}/phase09-${crypto.randomUUID()}.png`;
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7j9sAAAAASUVORK5CYII=",
    "base64",
  );
  const config = requireAdminConfig();
  const upload = await fetch(
    `${config.apiUrl}/storage/v1/object/identity-documents/${path}`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "image/png",
        "x-upsert": "true",
      },
      body: image,
    },
  );
  expect(upload.ok).toBeTruthy();

  const documentResponse = await adminRequest("/rest/v1/provider_documents", {
    method: "POST",
    body: JSON.stringify({
      user_id: provider.id,
      document_type: "DNI_FRONT",
      storage_path: path,
      mime_type: "image/png",
      file_size_bytes: image.length,
    }),
  });
  expect(documentResponse.ok).toBeTruthy();
  const documents = (await documentResponse.json()) as Array<{ id: string }>;
  expect(documents[0]?.id).toBeTruthy();
  return documents[0]!.id;
}

test.describe("Phase 09 admin trust and safety", () => {
  test("normal authenticated account cannot use the admin surface", async ({
    page,
  }) => {
    const member = await createTestUser("Usuario normal Phase 09");
    await login(page, member, "/account");
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Administración" }),
    ).toHaveCount(0);
  });

  test("admin reviews identity evidence, decides the case and sees the audit trail", async ({
    page,
  }) => {
    const admin = await createTestUser("Admin Phase 09");
    const provider = await createTestUser("Prestador Identity Phase 09");
    await promoteAdmin(admin.id);
    const documentId = await createIdentityCase(provider);

    await login(page, admin, `/admin/identity?provider=${provider.id}`);
    await expect(
      page.getByRole("heading", { name: "Revisión de identidad" }),
    ).toBeVisible();
    await expect(page.getByText("IDENTITY_PENDING")).toBeVisible();

    const signedResponse = await page.request.get(
      `/api/admin/identity-documents/${documentId}`,
      { maxRedirects: 0 },
    );
    expect(signedResponse.status()).toBe(302);
    expect(signedResponse.headers().location).toContain(
      "/storage/v1/object/sign/identity-documents/",
    );

    await page.getByRole("button", { name: "Aprobar identidad" }).click();
    await expect(page.getByText("ACTIVE")).toBeVisible();

    const providerState = await adminRequest(
      `/rest/v1/provider_profiles?user_id=eq.${provider.id}&select=status`,
    );
    const providerRows = (await providerState.json()) as Array<{
      status: string;
    }>;
    expect(providerRows[0]?.status).toBe("ACTIVE");

    await page.goto("/admin/audit");
    const auditCard = page
      .locator("article")
      .filter({ hasText: provider.id })
      .filter({ hasText: "IDENTITY_REVIEW_APPROVED" })
      .first();
    await expect(auditCard).toBeVisible();
  });

  test("admin resolves a report and disables then restores a marketplace service", async ({
    page,
  }) => {
    const admin = await createTestUser("Admin Moderación Phase 09");
    const client = await createTestUser("Cliente Reporte Phase 09");
    await promoteAdmin(admin.id);

    const conversationId = crypto.randomUUID();
    const reportId = crypto.randomUUID();
    const providerId = "23000000-0000-4000-8000-000000000001";
    const serviceId = "24000000-0000-4000-8000-000000000001";
    const resolution = `Caso resuelto E2E ${reportId}.`;

    let response = await adminRequest("/rest/v1/conversations", {
      method: "POST",
      body: JSON.stringify({
        id: conversationId,
        service_id: serviceId,
        client_user_id: client.id,
        provider_user_id: providerId,
      }),
    });
    expect(response.ok).toBeTruthy();
    response = await adminRequest("/rest/v1/conversation_participants", {
      method: "POST",
      body: JSON.stringify([
        { conversation_id: conversationId, user_id: client.id, role: "CLIENT" },
        {
          conversation_id: conversationId,
          user_id: providerId,
          role: "PROVIDER",
        },
      ]),
    });
    expect(response.ok).toBeTruthy();
    response = await adminRequest("/rest/v1/conversation_reports", {
      method: "POST",
      body: JSON.stringify({
        id: reportId,
        conversation_id: conversationId,
        reporter_user_id: client.id,
        category: "ABUSE",
        reason: `Reporte E2E Phase 09 ${reportId}`,
      }),
    });
    expect(response.ok).toBeTruthy();

    await login(page, admin, "/admin/reports");
    let reportCard = page.locator("article").filter({ hasText: reportId });
    await expect(reportCard).toContainText(`Reporte E2E Phase 09 ${reportId}`);
    await reportCard.getByPlaceholder("Resolución del caso").fill(resolution);
    await reportCard.getByRole("button", { name: "Resolver reporte" }).click();
    reportCard = page.locator("article").filter({ hasText: reportId });
    await expect(reportCard).toContainText(resolution);

    await page.goto("/admin/catalog");
    await expect(
      page.getByRole("heading", { name: "Catálogo y servicios" }),
    ).toBeVisible();
    const serviceCard = page.locator(
      `article:has(input[name="serviceId"][value="${serviceId}"]):has(input[name="state"][value="DISABLED"])`,
    );
    await expect(serviceCard).toHaveCount(1);
    const disableForm = serviceCard
      .getByRole("button", { name: "Deshabilitar" })
      .locator("xpath=ancestor::form");
    await disableForm
      .getByPlaceholder("Motivo")
      .fill(`Moderación E2E Phase 09 ${reportId}`);
    await disableForm.getByRole("button", { name: "Deshabilitar" }).click();

    let serviceState = await adminRequest(
      `/rest/v1/services?id=eq.${serviceId}&select=is_paused`,
    );
    let serviceRows = (await serviceState.json()) as Array<{
      is_paused: boolean;
    }>;
    expect(serviceRows[0]?.is_paused).toBe(true);

    const refreshedCard = page.locator(
      `article:has(input[name="serviceId"][value="${serviceId}"]):has(input[name="state"][value="CLEAR"])`,
    );
    await refreshedCard.getByRole("button", { name: "Restaurar" }).click();
    serviceState = await adminRequest(
      `/rest/v1/services?id=eq.${serviceId}&select=is_paused`,
    );
    serviceRows = (await serviceState.json()) as Array<{ is_paused: boolean }>;
    expect(serviceRows[0]?.is_paused).toBe(false);
  });

  test("admin manages synonym and service tag CRUD from the catalog", async ({
    page,
  }) => {
    const admin = await createTestUser("Admin Taxonomía Phase 09");
    const suffix = crypto.randomUUID().slice(0, 8);
    const synonymInitial = `phase09 alias ${suffix}`;
    const synonymUpdated = `phase09 alias actualizado ${suffix}`;
    const tagInitial = `phase09 tag ${suffix}`;
    const tagUpdated = `phase09 tag actualizado ${suffix}`;

    await promoteAdmin(admin.id);
    await login(page, admin, "/admin/catalog");
    await expect(
      page.getByRole("heading", { name: "Catálogo y servicios" }),
    ).toBeVisible();

    const synonymCreateForm = page
      .getByRole("button", { name: "Crear sinónimo" })
      .locator("xpath=ancestor::form");
    await synonymCreateForm.locator('select[name="skillId"]').selectOption({
      index: 0,
    });
    await synonymCreateForm
      .getByPlaceholder("Frase equivalente")
      .fill(synonymInitial);
    await synonymCreateForm
      .getByRole("button", { name: "Crear sinónimo" })
      .click();

    let synonymCard = page
      .locator("article")
      .filter({ hasText: synonymInitial });
    await expect(synonymCard).toHaveCount(1);
    await synonymCard.locator('input[name="phrase"]').fill(synonymUpdated);
    await synonymCard.getByRole("button", { name: "Actualizar" }).click();
    synonymCard = page.locator("article").filter({ hasText: synonymUpdated });
    await expect(synonymCard).toHaveCount(1);
    await synonymCard.getByRole("button", { name: "Eliminar" }).click();
    await expect(
      page.locator("article").filter({ hasText: synonymUpdated }),
    ).toHaveCount(0);

    const tagCreateForm = page
      .getByRole("button", { name: "Crear tag" })
      .locator("xpath=ancestor::form");
    await tagCreateForm.locator('select[name="serviceId"]').selectOption({
      index: 0,
    });
    await tagCreateForm.getByPlaceholder("Tag de búsqueda").fill(tagInitial);
    await tagCreateForm.getByRole("button", { name: "Crear tag" }).click();

    let tagCard = page.locator("article").filter({ hasText: tagInitial });
    await expect(tagCard).toHaveCount(1);
    await tagCard.locator('input[name="tag"]').fill(tagUpdated);
    await tagCard.getByRole("button", { name: "Actualizar" }).click();
    tagCard = page.locator("article").filter({ hasText: tagUpdated });
    await expect(tagCard).toHaveCount(1);
    await tagCard.getByRole("button", { name: "Eliminar" }).click();
    await expect(
      page.locator("article").filter({ hasText: tagUpdated }),
    ).toHaveCount(0);

    await page.goto("/admin/audit");
    await expect(
      page.getByText("CATALOG_TAG_CREATED", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("CATALOG_TAG_UPDATED", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("CATALOG_TAG_DELETED", { exact: true }).first(),
    ).toBeVisible();
  });
});

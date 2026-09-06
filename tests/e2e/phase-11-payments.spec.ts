import { expect, test, type Page } from "@playwright/test";

const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

type TestUser = { id: string; email: string; password: string };

function requireConfig() {
  if (!apiUrl || !serviceRoleKey) {
    throw new Error("Phase 11 E2E requires local Supabase admin credentials.");
  }
  return { apiUrl, serviceRoleKey };
}

async function adminRequest(path: string, init: RequestInit = {}) {
  const config = requireConfig();
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

async function createUser(label: string): Promise<TestUser> {
  const suffix = crypto.randomUUID();
  const user = {
    email: `phase11-e2e-${suffix}@example.test`,
    password: `Phase11-${suffix}-Password!`,
  };
  const response = await adminRequest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      ...user,
      email_confirm: true,
      user_metadata: { display_name: label },
    }),
  });
  expect(response.ok).toBeTruthy();
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error("Phase 11 user response has no id.");
  return { id: body.id, ...user };
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

test.describe("Phase 11 payment administration", () => {
  test("normal authenticated account cannot access payment reconciliation", async ({
    page,
  }) => {
    const member = await createUser("Miembro Phase 11");
    await login(page, member, "/account");

    const response = await page.goto("/admin/payments");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Pagos y conciliación" }),
    ).toHaveCount(0);
  });

  test("admin sees the safe payment console and reconciliation control", async ({
    page,
  }) => {
    const admin = await createUser("Admin Payments Phase 11");
    await promoteAdmin(admin.id);
    await login(page, admin, "/admin/payments");

    await expect(
      page.getByRole("heading", { name: "Pagos y conciliación" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Conciliar Mercado Pago" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ejecuciones de conciliación" }),
    ).toBeVisible();

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("access_token");
    expect(body).not.toContain("refresh_token");
    expect(body).not.toContain("ciphertext");
  });
});

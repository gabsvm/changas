import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createTestUser(): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Phase 04 E2E requires local Supabase admin credentials.");
  }

  const suffix = crypto.randomUUID();
  const email = `phase04-e2e-${suffix}@example.test`;
  const password = `Phase04-${suffix}-Password!`;
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Cliente E2E Phase 04" },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Could not create Phase 04 E2E user: ${response.status} ${await response.text()}`,
    );
  }

  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error("Phase 04 E2E user response has no id.");

  return { id: body.id, email, password };
}

async function deleteTestUser(id: string): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) return;

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Could not delete Phase 04 E2E user: ${response.status} ${await response.text()}`,
    );
  }
}

test.describe("Phase 04 contextual conversations", () => {
  test("authenticated client can use the protected conversation flow", async ({
    page,
  }) => {
    const user = await createTestUser();

    try {
      await page.goto("/login");
      await page.getByLabel("Correo electrónico").fill(user.email);
      await page.getByLabel("Contraseña").fill(user.password);
      await page.getByRole("button", { name: "Iniciar sesión" }).click();
      await expect(page).toHaveURL(/\/account$/);

      await page.goto("/p/demo-proveedor/demo-revision-pc");
      await expect(
        page.getByRole("heading", { name: "Revisión de PC a distancia" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Consultar por este servicio" })
        .click();

      await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/i);
      await expect(page.getByText("Demo Proveedor").first()).toBeVisible();
      await expect(
        page.getByText("Revisión de PC a distancia").first(),
      ).toBeVisible();

      const composer = page.getByPlaceholder("Escribí un mensaje…");
      await composer.fill("Hola, quisiera coordinar el diagnóstico.");
      await page.getByRole("button", { name: "Enviar", exact: true }).click();
      await expect(
        page.getByText("Hola, quisiera coordinar el diagnóstico.", {
          exact: true,
        }),
      ).toBeVisible();

      const contactText = `Mi correo es phase04-${crypto.randomUUID()}@example.test`;
      await composer.fill(contactText);
      await page.getByRole("button", { name: "Enviar", exact: true }).click();
      await expect(
        page.getByText("Revisá antes de enviar", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(contactText, { exact: true })).toHaveCount(0);

      await page
        .getByRole("button", { name: "Enviar de todos modos" })
        .click();
      await expect(page.getByText(contactText, { exact: true })).toBeVisible();

      await page.getByText("···", { exact: true }).click();
      await page.getByRole("button", { name: "Bloquear persona" }).click();
      await expect(
        page.getByRole("button", {
          name: "Desbloquear para volver a escribir",
        }),
      ).toBeVisible();
      await expect(page.getByPlaceholder("Escribí un mensaje…")).toHaveCount(0);

      await page
        .getByRole("button", { name: "Desbloquear para volver a escribir" })
        .click();
      await expect(page.getByPlaceholder("Escribí un mensaje…")).toBeVisible();

      await page.goto("/messages");
      await expect(
        page.getByRole("link", { name: /Demo Proveedor/ }).first(),
      ).toBeVisible();
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

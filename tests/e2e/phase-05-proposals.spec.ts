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
    throw new Error("Phase 05 E2E requires local Supabase admin credentials.");
  }

  const suffix = crypto.randomUUID();
  const email = `phase05-e2e-${suffix}@example.test`;
  const password = `Phase05-${suffix}-Password!`;
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
      user_metadata: { display_name: "Cliente E2E Phase 05" },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Could not create Phase 05 E2E user: ${response.status} ${await response.text()}`,
    );
  }

  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error("Phase 05 E2E user response has no id.");

  return { id: body.id, email, password };
}

async function deleteTestConversations(clientUserId: string): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) return;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/conversations?client_user_id=eq.${encodeURIComponent(clientUserId)}`,
    {
      method: "DELETE",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=minimal",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Could not delete Phase 05 E2E conversations: ${response.status} ${await response.text()}`,
    );
  }
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
      `Could not delete Phase 05 E2E user: ${response.status} ${await response.text()}`,
    );
  }
}

async function cleanupTestUser(id: string): Promise<void> {
  await deleteTestConversations(id);
  await deleteTestUser(id);
}

test.describe("Phase 05 structured proposals", () => {
  test("client can create a fixed-price booking and production hides fake payment controls", async ({
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
      await page
        .getByRole("button", { name: "Consultar por este servicio" })
        .click();
      await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/i);

      await page.getByText("Proponer un acuerdo", { exact: true }).click();
      const proposalForm = page.locator("form").filter({
        has: page.getByRole("button", { name: "Enviar propuesta" }),
      });
      await proposalForm
        .locator('select[name="kind"]')
        .selectOption("DIRECT_BOOKING");
      await proposalForm
        .getByLabel("Alcance")
        .fill("Diagnóstico remoto reservado desde el smoke de Phase 05.");
      await proposalForm
        .getByRole("button", { name: "Enviar propuesta" })
        .click();

      await expect(
        page.getByText("Propuesta creada.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Reserva directa · v1", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Esperando pago", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Diagnóstico remoto reservado desde el smoke de Phase 05.",
          { exact: true },
        ),
      ).toBeVisible();

      await expect(
        page.getByText("Pago simulado · solo desarrollo", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Simular aprobado" }),
      ).toHaveCount(0);
    } finally {
      await cleanupTestUser(user.id);
    }
  });
});

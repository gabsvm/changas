import { expect, test, type Page } from "@playwright/test";

const supabaseUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireAdminConfig() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Phase 07 E2E requires local Supabase admin credentials.");
  }
  return { supabaseUrl, serviceRoleKey };
}

function adminHeaders(extra?: Record<string, string>) {
  const config = requireAdminConfig();
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
}

async function createTestUser(): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  const config = requireAdminConfig();
  const suffix = crypto.randomUUID();
  const email = `phase07-e2e-${suffix}@example.test`;
  const password = `Phase07-${suffix}-Password!`;
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Cliente E2E Phase 07" },
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Could not create Phase 07 E2E user: ${response.status} ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error("Phase 07 E2E user response has no id.");
  return { id: body.id, email, password };
}

async function proposalIds(clientUserId: string): Promise<string[]> {
  const config = requireAdminConfig();
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/proposals?client_user_id=eq.${clientUserId}&select=id&order=created_at.asc`,
    { headers: adminHeaders() },
  );
  if (!response.ok) {
    throw new Error(
      `Could not query Phase 07 proposals: ${await response.text()}`,
    );
  }
  return ((await response.json()) as Array<{ id: string }>).map(
    (row) => row.id,
  );
}

async function confirmProposal(
  proposalId: string,
  clientUserId: string,
): Promise<string> {
  const config = requireAdminConfig();
  const nonce = crypto.randomUUID();
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/rpc/apply_payment_result`,
    {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        target_proposal_id: proposalId,
        payment_nonce: nonce,
        payment_provider_name: "E2E",
        payment_provider_reference: `phase07-e2e-${nonce}`,
        payment_result_status: "SUCCEEDED",
        actor_client_user_id: clientUserId,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Could not confirm Phase 07 proposal: ${await response.text()}`,
    );
  }
  const rows = (await response.json()) as Array<{ confirmed_job_id?: string }>;
  if (!rows[0]?.confirmed_job_id) {
    throw new Error("Phase 07 payment response has no confirmed Job.");
  }
  return rows[0].confirmed_job_id;
}

async function markJobCompleted(jobId: string) {
  const config = requireAdminConfig();
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/jobs?id=eq.${jobId}`,
    {
      method: "PATCH",
      headers: adminHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ status: "COMPLETED" }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Could not complete Phase 07 Job fixture: ${await response.text()}`,
    );
  }
}

test.describe("Phase 07 reputation", () => {
  test("completed Job supports one verified review, rehire and reputation-aware favorites", async ({
    page,
  }) => {
    const user = await createTestUser();
    const reviewText = `Excelente trabajo E2E ${crypto.randomUUID()}`;

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
      .fill("Trabajo E2E para reputación Phase 07");
    await proposalForm
      .getByRole("button", { name: "Enviar propuesta" })
      .click();
    await expect(
      page.getByText("Propuesta creada.", { exact: true }),
    ).toBeVisible();

    const initialProposals = await proposalIds(user.id);
    expect(initialProposals).toHaveLength(1);
    const jobId = await confirmProposal(initialProposals[0], user.id);
    await markJobCompleted(jobId);

    await page.goto(`/jobs/${jobId}`);
    await expect(page.getByText("Completado", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Reseña del trabajo" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Volver a contratar" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Publicar reseña" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByLabel("Calificación general").selectOption("5");
    await page.getByLabel("Calidad").selectOption("5");
    await page.getByLabel("Puntualidad").selectOption("4");
    await page.getByLabel("Comunicación").selectOption("5");
    await page.getByLabel("Comentario").fill(reviewText);
    await page.getByRole("button", { name: "Publicar reseña" }).click();

    await expect(page.getByText(reviewText, { exact: true })).toBeVisible();
    await expect(
      page.getByText("Reseña verificada de este Job", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Publicar reseña" }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Volver a contratar" }).click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/i);
    const afterRehire = await proposalIds(user.id);
    expect(afterRehire).toHaveLength(2);
    expect(afterRehire[1]).not.toBe(initialProposals[0]);

    await page.goto("/p/demo-proveedor");
    await page.getByRole("button", { name: "Guardar proveedor" }).click();
    await expect(
      page.getByRole("button", { name: "Quitar guardado" }),
    ).toBeVisible();
    await page.goto("/account/favorites");
    await expect(
      page.getByRole("heading", { name: "Proveedores guardados" }),
    ).toBeVisible();
    await expect(
      page.getByText("Proveedor guardado", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/reseñas?/)).toBeVisible();
    await expect(page.getByText(/completados/)).toBeVisible();
    await expect(page.getByText(/finalización/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

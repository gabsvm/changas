import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireAdminConfig() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Phase 06 E2E requires local Supabase admin credentials.");
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

async function createTestUser(): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  const config = requireAdminConfig();
  const suffix = crypto.randomUUID();
  const email = `phase06-e2e-${suffix}@example.test`;
  const password = `Phase06-${suffix}-Password!`;
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Cliente E2E Phase 06" },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Could not create Phase 06 E2E user: ${response.status} ${await response.text()}`,
    );
  }

  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error("Phase 06 E2E user response has no id.");
  return { id: body.id, email, password };
}

async function latestProposalId(clientUserId: string): Promise<string> {
  const config = requireAdminConfig();
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/proposals?client_user_id=eq.${clientUserId}&select=id&order=created_at.desc&limit=1`,
    { headers: adminHeaders() },
  );
  if (!response.ok) {
    throw new Error(
      `Could not query Phase 06 proposal: ${await response.text()}`,
    );
  }
  const rows = (await response.json()) as Array<{ id?: string }>;
  if (!rows[0]?.id) throw new Error("Phase 06 proposal fixture was not found.");
  return rows[0].id;
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
        payment_provider_reference: `phase06-e2e-${nonce}`,
        payment_result_status: "SUCCEEDED",
        actor_client_user_id: clientUserId,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Could not confirm Phase 06 proposal: ${await response.text()}`,
    );
  }
  const rows = (await response.json()) as Array<{ confirmed_job_id?: string }>;
  if (!rows[0]?.confirmed_job_id) {
    throw new Error("Phase 06 payment response has no confirmed Job.");
  }
  return rows[0].confirmed_job_id;
}

async function createAwaitingAdditionalPayment(jobId: string) {
  const config = requireAdminConfig();
  const jobResponse = await fetch(
    `${config.supabaseUrl}/rest/v1/jobs?id=eq.${jobId}&select=provider_user_id`,
    { headers: adminHeaders() },
  );
  if (!jobResponse.ok) {
    throw new Error(
      `Could not query Phase 06 Job: ${await jobResponse.text()}`,
    );
  }
  const jobs = (await jobResponse.json()) as Array<{
    provider_user_id?: string;
  }>;
  const providerUserId = jobs[0]?.provider_user_id;
  if (!providerUserId) throw new Error("Phase 06 Job has no provider fixture.");

  const scopeResponse = await fetch(
    `${config.supabaseUrl}/rest/v1/job_scope_changes`,
    {
      method: "POST",
      headers: adminHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        job_id: jobId,
        requested_by_user_id: providerUserId,
        status: "AWAITING_PAYMENT",
        scope_snapshot:
          "Adicional sintético para verificar producción sin controles fake.",
        additional_amount_minor: 50000,
        currency_code: "ARS",
        client_responded_at: new Date().toISOString(),
      }),
    },
  );
  if (!scopeResponse.ok) {
    throw new Error(
      `Could not create Phase 06 scope change fixture: ${await scopeResponse.text()}`,
    );
  }
}

test.describe("Phase 06 Jobs", () => {
  test("confirmed Job keeps contractual snapshot and production hides fake additional-payment controls", async ({
    page,
  }) => {
    const user = await createTestUser();
    const scope = `Alcance contractual E2E Phase 06 ${crypto.randomUUID()}`;

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
    await proposalForm.getByLabel("Alcance").fill(scope);
    await proposalForm
      .getByRole("button", { name: "Enviar propuesta" })
      .click();
    await expect(
      page.getByText("Propuesta creada.", { exact: true }),
    ).toBeVisible();

    const proposalId = await latestProposalId(user.id);
    const jobId = await confirmProposal(proposalId, user.id);
    await createAwaitingAdditionalPayment(jobId);

    await page.goto("/jobs");
    await expect(
      page.getByRole("heading", { name: "Mis trabajos" }),
    ).toBeVisible();
    await expect(page.getByText("CONFIRMED", { exact: true })).toBeVisible();

    await page.locator(`a[href="/jobs/${jobId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/jobs/${jobId}$`));
    await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Alcance congelado", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(scope, { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "Adicional sintético para verificar producción sin controles fake.",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    await expect(
      page.getByText("AWAITING PAYMENT", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Simular pago aprobado" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Simular fallo" }),
    ).toHaveCount(0);
  });
});

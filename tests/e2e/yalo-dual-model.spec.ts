import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function getLocalIp(): string {
  try {
    const wsl = execSync("wsl hostname -I", { encoding: "utf8" })
      .trim()
      .split(" ")[0];
    if (wsl) return wsl;
  } catch {}
  return "127.0.0.1";
}

const localIp = getLocalIp();
const supabaseUrl =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  `http://${localIp}:54321`;
const serviceRoleKey =
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl =
  process.env.DATABASE_URL ??
  `postgres://postgres:postgres@${localIp}:54322/postgres`;

function requireCredentials() {
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for YALO E2E.");
  }
  return { supabaseUrl, serviceRoleKey, dbUrl };
}

function adminHeaders() {
  const { serviceRoleKey } = requireCredentials();
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function createAuthUser(
  emailPrefix: string,
  displayName: string,
): Promise<{ id: string; email: string; pass: string }> {
  const { supabaseUrl } = requireCredentials();
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `${emailPrefix}-${suffix}@example.test`;
  const pass = `YaloPass123!-${suffix}`;

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      email,
      password: pass,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to create synthetic user ${email}: ${res.status} ${await res.text()}`,
    );
  }

  const json = (await res.json()) as { id: string };
  return { id: json.id, email, pass };
}

function attachErrorListeners(page: Page, label: string, errors: string[]) {
  page.on("pageerror", (err) => {
    errors.push(`[${label} pageerror] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Filter out benign static/favicon 404s
      if (
        !text.includes("favicon") &&
        !text.includes("manifest.webmanifest") &&
        !text.includes("status of 404")
      ) {
        errors.push(`[${label} console.error] ${text}`);
      }
    }
  });
}

async function captureScreenshot(page: Page, filename: string) {
  const dir = path.resolve(process.cwd(), "test-results", "yalo-screenshots");
  await fs.promises.mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, filename), fullPage: true });
}

async function openDetails(page: Page, summaryText: string | RegExp) {
  const details = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: summaryText }) });
  await details.evaluate((el: HTMLDetailsElement) => {
    el.open = true;
  });
}

async function loginUser(page: Page, email: string, pass: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(pass);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/account/);
}

test.describe("YALO Dual Model Validation (PR #29)", () => {
  test.setTimeout(180_000);

  test("Model A (Direct Selection) and Model B (Open Need) Full Lifecycle", async ({
    browser,
  }) => {
    const { dbUrl } = requireCredentials();
    const runId = Math.random().toString(16).slice(2, 8);
    const consoleErrors: string[] = [];

    // 1. Create synthetic accounts
    const clientUser = await createAuthUser(`cliente-${runId}`, "Cliente YALO");
    const provider1User = await createAuthUser(
      `p1-${runId}`,
      "Prestador Presencial",
    );
    const provider2User = await createAuthUser(
      `p2-${runId}`,
      "Prestador Remoto",
    );

    const p1Slug = `p1-${runId}`;
    const p2Slug = `p2-${runId}`;
    const s1Slug = `cerrajeria-urgencia-${runId}`;
    const s2Slug = `web-landing-${runId}`;

    // 2. Setup DB fixtures for providers and services
    const db = new pg.Client({ connectionString: dbUrl });
    await db.connect();

    let inPersonSkillId: string;
    let remoteSkillId: string;

    try {
      const skillsRes = await db.query(
        "SELECT id, name FROM skills WHERE is_active ORDER BY sort_order, id LIMIT 4",
      );
      inPersonSkillId = skillsRes.rows[0].id;
      remoteSkillId = skillsRes.rows[1].id;

      // Provider 1 Profile & Service (In-Person)
      await db.query(
        `
        INSERT INTO provider_profiles (user_id, status, onboarding_step, public_slug, public_headline)
        VALUES ($1, 'ACTIVE', 4, $2, 'Cerrajería y Seguridad Presencial')
        ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE', marketplace_paused = false;
      `,
        [provider1User.id, p1Slug],
      );

      await db.query(
        `
        INSERT INTO provider_skills (provider_user_id, skill_id)
        VALUES ($1, $2) ON CONFLICT DO NOTHING;
      `,
        [provider1User.id, inPersonSkillId],
      );

      await db.query(
        `
        INSERT INTO services (
          id, provider_user_id, skill_id, public_slug, title, description,
          modality, price_model, price_amount, currency_code, accepts_offers,
          schedule_type, is_published, is_paused, instant_booking_enabled
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 'Cerrajería y Apertura de Emergencia',
          'Servicio presencial rápido para aperturas de urgencia y cambios de combinación.',
          'IN_PERSON', 'FIXED', 1500000, 'ARS', true,
          'UNSCHEDULED', true, false, false
        );
      `,
        [provider1User.id, inPersonSkillId, s1Slug],
      );

      // Provider 2 Profile & Service (Remote)
      await db.query(
        `
        INSERT INTO provider_profiles (user_id, status, onboarding_step, public_slug, public_headline)
        VALUES ($1, 'ACTIVE', 4, $2, 'Desarrollo Web & Soluciones Digitales')
        ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE', marketplace_paused = false;
      `,
        [provider2User.id, p2Slug],
      );

      await db.query(
        `
        INSERT INTO provider_skills (provider_user_id, skill_id)
        VALUES ($1, $2) ON CONFLICT DO NOTHING;
      `,
        [provider2User.id, remoteSkillId],
      );

      await db.query(
        `
        INSERT INTO services (
          id, provider_user_id, skill_id, public_slug, title, description,
          modality, price_model, price_amount, currency_code, accepts_offers,
          schedule_type, is_published, is_paused, instant_booking_enabled
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 'Desarrollo de Landing Page y Web App',
          'Servicio de diseño y maquetación web digital a distancia.',
          'REMOTE', 'FIXED', 5000000, 'ARS', true,
          'UNSCHEDULED', true, false, false
        );
      `,
        [provider2User.id, remoteSkillId, s2Slug],
      );
    } finally {
      await db.end();
    }

    // 3. Create independent browser contexts
    const clientCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const p1Ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const p2Ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    const clientPage = await clientCtx.newPage();
    const p1Page = await p1Ctx.newPage();
    const p2Page = await p2Ctx.newPage();

    attachErrorListeners(clientPage, "Client", consoleErrors);
    attachErrorListeners(p1Page, "Provider1", consoleErrors);
    attachErrorListeners(p2Page, "Provider2", consoleErrors);

    // Login users into their separate sessions
    await loginUser(clientPage, clientUser.email, clientUser.pass);
    await loginUser(p1Page, provider1User.email, provider1User.pass);
    await loginUser(p2Page, provider2User.email, provider2User.pass);

    // =========================================================================
    // MODEL A: DIRECT SELECTION (PRESENCIAL)
    // =========================================================================
    console.log("--- Starting Model A: Direct Selection (Presencial) ---");

    // Client visits Provider 1's service page
    await clientPage.goto(`/p/${p1Slug}/${s1Slug}`);
    await expect(
      clientPage.getByRole("heading", {
        name: "Cerrajería y Apertura de Emergencia",
      }),
    ).toBeVisible();
    await captureScreenshot(clientPage, "01-model-a-service-desktop.png");

    // Client requests quotation
    const quoteButton = clientPage.getByRole("button", {
      name: /pedir cotización/i,
    });
    await expect(quoteButton).toBeVisible();
    await quoteButton.click();

    // Redirected to conversation (may include ?kind=...)
    await expect(clientPage).toHaveURL(/\/messages\/[0-9a-f-]{36}/i);
    const convMatch = clientPage.url().match(/\/messages\/([0-9a-f-]{36})/i);
    if (!convMatch)
      throw new Error("Conversation URL does not contain valid UUID");
    const convId = convMatch[1];
    await captureScreenshot(clientPage, "02-model-a-conversation-desktop.png");

    // Provider 1 visits the conversation and proposes an agreement
    await p1Page.goto(`/messages/${convId}`);
    await expect(
      p1Page.getByText("Cerrajería y Apertura de Emergencia").first(),
    ).toBeVisible();

    await openDetails(p1Page, /Enviar una cotización|Proponer un acuerdo/);
    const proposalForm = p1Page.locator("form").filter({
      has: p1Page.getByRole("button", { name: "Enviar propuesta" }),
    });
    await proposalForm.locator('input[name="price"]').fill("15000");
    await proposalForm
      .locator('textarea[name="scope"]')
      .fill("Apertura de cerradura de seguridad sin rotura y cambio de perno.");
    await proposalForm.evaluate((form: HTMLFormElement) =>
      form.requestSubmit(),
    );
    await expect(
      p1Page.getByText("Propuesta creada.", { exact: true }),
    ).toBeVisible();

    // Client accepts the proposal
    await clientPage.reload();
    await expect(
      clientPage
        .getByText("Apertura de cerradura de seguridad sin rotura")
        .first(),
    ).toBeVisible();

    // Two-step hire confirmation on ProposalCard
    const hireButton = clientPage.getByRole("button", { name: "Contratar" });
    await expect(hireButton).toBeVisible();
    await hireButton.click({ force: true });

    const confirmHireButton = clientPage.getByRole("button", {
      name: "Confirmar contratación",
    });
    await expect(confirmHireButton).toBeVisible();
    await confirmHireButton.click({ force: true });

    // Post-acceptance banner appears with link to Job
    await expect(
      clientPage.getByText(/ya tiene un servicio en marcha/i),
    ).toBeVisible({ timeout: 15_000 });
    const viewJobLink = clientPage.getByRole("link", {
      name: "Ver seguimiento →",
    });
    await expect(viewJobLink).toBeVisible({ timeout: 15_000 });
    const jobHref = await viewJobLink.getAttribute("href");
    if (!jobHref) throw new Error("Job link not found in conversation.");
    const jobId = jobHref.split("/jobs/")[1];

    // Client opens Job page
    await clientPage.goto(`/jobs/${jobId}`);
    await expect(clientPage.getByText("Confirmado").first()).toBeVisible({
      timeout: 15_000,
    });
    await captureScreenshot(clientPage, "03-model-a-job-confirmed-desktop.png");

    // Provider 1 starts the job
    await p1Page.goto(`/jobs/${jobId}`);
    const startJobButton = p1Page.getByRole("button", {
      name: "Iniciar trabajo",
    });
    await expect(startJobButton).toBeVisible();
    await startJobButton.click({ force: true });
    await expect(
      p1Page.locator('textarea[name="deliverySummary"]'),
    ).toBeVisible({ timeout: 15_000 });

    // Provider 1 submits delivery summary
    await p1Page
      .locator('textarea[name="deliverySummary"]')
      .fill("Se realizó la apertura de cerradura y se colocó el nuevo perno.");
    await p1Page
      .getByRole("button", { name: "Enviar para revisión" })
      .click({ force: true });
    await expect(p1Page.locator('input[name="confirmationCode"]')).toBeVisible({
      timeout: 15_000,
    });

    // Client reloads job page to see the generated PIN
    await clientPage.reload();
    const pinEl = clientPage.locator('[aria-label^="PIN de entrega"]');
    await expect(pinEl).toBeVisible({ timeout: 15_000 });
    const pinText = (await pinEl.innerText()).trim();
    expect(pinText).toMatch(/^\d{4}$/);

    // Provider 1 enters the 4-digit PIN in ConfirmationCodeForm
    await p1Page.locator('input[name="confirmationCode"]').fill(pinText);
    await p1Page
      .getByRole("button", { name: "Dejar constancia de entrega" })
      .click({ force: true });
    await expect(
      p1Page.locator('input[name="confirmationCode"]'),
    ).not.toBeVisible({ timeout: 15_000 });

    // Client reviews and confirms completion (S3: bilateral closure)
    await clientPage.reload();
    await expect(
      clientPage.getByRole("button", { name: "Revisar y confirmar" }),
    ).toBeVisible({ timeout: 15_000 });
    await clientPage
      .getByRole("button", { name: "Revisar y confirmar" })
      .click({ force: true });
    const finalConfirmButtonA = clientPage.getByRole("button", {
      name: /Confirmar trabajo por/i,
    });
    await expect(finalConfirmButtonA).toBeVisible({ timeout: 15_000 });
    await finalConfirmButtonA.click({ force: true });

    // Status transitions to COMPLETED
    await expect(clientPage.getByText("Completado").first()).toBeVisible({
      timeout: 15_000,
    });
    await captureScreenshot(
      clientPage,
      "04-model-a-handover-verified-desktop.png",
    );

    // External money declaration: Provider 1 declares payment received
    await p1Page.reload();
    await openDetails(p1Page, "Registrar dinero recibido");
    await p1Page.locator('input[name="amount"]').fill("15000");
    await p1Page.locator('select[name="method"]').selectOption("TRANSFERENCIA");
    await p1Page
      .getByRole("button", { name: "Enviar declaración" })
      .click({ force: true });

    // Client confirms payment
    await clientPage.reload();
    const confirmPaymentButton = clientPage.getByRole("button", {
      name: "Confirmar que lo pagué",
    });
    await expect(confirmPaymentButton).toBeVisible({ timeout: 15_000 });
    await confirmPaymentButton.click({ force: true });

    await expect(clientPage.getByText("Saldo").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      clientPage.getByText("$0", { exact: false }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Client leaves a 5-star review
    await clientPage.locator('select[name="rating"]').selectOption("5");
    await clientPage
      .locator('textarea[name="reviewText"]')
      .fill("Excelente cerrajero, super rápido y confiable.");
    await clientPage
      .getByRole("button", { name: "Publicar reseña" })
      .click({ force: true });

    await expect(
      clientPage.getByText("Reseña verificada de este trabajo").first(),
    ).toBeVisible({ timeout: 15_000 });
    await captureScreenshot(clientPage, "05-model-a-reviewed-desktop.png");

    console.log(
      "[OK] Model A: Direct Selection (Presencial) completed successfully!",
    );

    // =========================================================================
    // MODEL B: OPEN NEED (REMOTO)
    // =========================================================================
    console.log("--- Starting Model B: Open Need (Remoto) ---");

    // Client creates public need via Mobile viewport
    await clientPage.setViewportSize({ width: 390, height: 844 });
    await clientPage.goto("/needs/new");
    await expect(
      clientPage.getByText("Publicar necesidad").first(),
    ).toBeVisible({ timeout: 15_000 });

    // Step 0: rubro, title, description
    await clientPage
      .locator('select[name="skillId"]')
      .selectOption(remoteSkillId);
    await clientPage
      .locator('input[name="title"]')
      .fill("Desarrollo de landing page responsive en Next.js");
    await clientPage
      .locator('textarea[name="description"]')
      .fill(
        "Necesito crear una landing page institucional con diseño responsive y componentes interactivos.",
      );
    await clientPage
      .getByRole("button", { name: "Continuar" })
      .click({ force: true });

    // Step 1: location & budget
    await clientPage
      .locator('input[name="locationText"]')
      .fill("Remoto / Todo el país");
    await clientPage.locator('input[name="desiredBudgetAmount"]').fill("50000");
    await clientPage
      .getByRole("button", { name: "Continuar" })
      .click({ force: true });

    // Step 2: Review and submit
    await expect(
      clientPage.getByText("Revisá antes de publicar"),
    ).toBeVisible();
    await captureScreenshot(clientPage, "06-model-b-need-published-mobile.png");
    await clientPage
      .getByRole("button", { name: "Publicar necesidad" })
      .click({ force: true });

    // Client is redirected to /needs/[postId]
    await expect(clientPage).toHaveURL(/\/needs\/[0-9a-f-]{36}$/i);
    const needUrl = clientPage.url();
    const postId = needUrl.split("/needs/")[1];

    // Provider 2 visits the need page to submit an offer
    await p2Page.goto(`/needs/${postId}`);
    await expect(
      p2Page
        .getByText("Desarrollo de landing page responsive en Next.js")
        .first(),
    ).toBeVisible();

    // Provider 2 selects their remote service and clicks "Ofertar en esta necesidad"
    const offerSelect = p2Page.locator('select[name="serviceId"]');
    await expect(offerSelect).toBeVisible();
    // Select first available service option
    await offerSelect.selectOption({ index: 1 });
    await p2Page
      .getByRole("button", { name: "Ofertar en esta necesidad" })
      .click({ force: true });

    // Provider 2 is redirected to the conversation and submits their quotation
    await expect(p2Page).toHaveURL(/\/messages\/[0-9a-f-]{36}/i);
    await openDetails(p2Page, /Enviar una cotización|Proponer un acuerdo/);
    const proposalForm2 = p2Page.locator("form").filter({
      has: p2Page.getByRole("button", { name: "Enviar propuesta" }),
    });
    await proposalForm2.locator('input[name="price"]').fill("50000");
    await proposalForm2
      .locator('textarea[name="scope"]')
      .fill(
        "Desarrollo completo de landing page en Next.js con diseño responsive y componentes interactivos.",
      );
    await proposalForm2.evaluate((form: HTMLFormElement) =>
      form.requestSubmit(),
    );
    await expect(
      p2Page.getByText("Propuesta creada.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // Client visits /needs/[postId] on desktop to compare offers
    await clientPage.setViewportSize({ width: 1280, height: 800 });
    await clientPage.goto(`/needs/${postId}`);
    await expect(
      clientPage.getByText("1 oferta recibida").first(),
    ).toBeVisible();
    await captureScreenshot(clientPage, "07-model-b-need-awarded-desktop.png");

    const compareOfferCta = clientPage.getByRole("link", {
      name: "Ver oferta y contratar",
    });
    await expect(compareOfferCta).toBeVisible();
    await compareOfferCta.click({ force: true });

    // Client accepts Provider 2's offer via ProposalCard
    await expect(clientPage).toHaveURL(/\/messages\/[0-9a-f-]{36}/i);
    const hireOfferButton = clientPage.getByRole("button", {
      name: "Contratar",
    });
    await expect(hireOfferButton).toBeVisible();
    await hireOfferButton.click({ force: true });

    const confirmHireOfferButton = clientPage.getByRole("button", {
      name: "Confirmar contratación",
    });
    await expect(confirmHireOfferButton).toBeVisible();
    await confirmHireOfferButton.click({ force: true });

    // Post is awarded (HIRED) and Job is created
    await expect(
      clientPage.getByText(/ya tiene un servicio en marcha/i),
    ).toBeVisible({ timeout: 15_000 });
    const remoteJobLink = clientPage.getByRole("link", {
      name: "Ver seguimiento →",
    });
    await expect(remoteJobLink).toBeVisible({ timeout: 15_000 });
    const remoteJobHref = await remoteJobLink.getAttribute("href");
    if (!remoteJobHref)
      throw new Error("Remote job link not found in conversation.");
    const remoteJobId = remoteJobHref.split("/jobs/")[1];

    // Provider 2 starts remote job
    await p2Page.goto(`/jobs/${remoteJobId}`);
    await p2Page
      .getByRole("button", { name: "Iniciar trabajo" })
      .click({ force: true });
    await expect(
      p2Page.locator('textarea[name="deliverySummary"]'),
    ).toBeVisible({ timeout: 15_000 });

    // Provider 2 submits digital delivery (first iteration)
    await p2Page
      .locator('textarea[name="deliverySummary"]')
      .fill("Entrega inicial del sitio web montado en repositorio.");
    await p2Page
      .locator('input[name="deliveryEvidenceUrl"]')
      .fill("https://github.com/gabsvm/changas");
    await p2Page
      .getByRole("button", { name: "Enviar para revisión" })
      .click({ force: true });
    await expect(
      p2Page.getByText(/esperando revisión|Pendiente de cierre/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    await captureScreenshot(p2Page, "08-model-b-delivery-submitted.png");

    // Client requests a correction
    await clientPage.goto(`/jobs/${remoteJobId}`);
    await expect(
      clientPage.getByRole("button", { name: "Revisar y confirmar" }),
    ).toBeVisible({ timeout: 15_000 });
    await clientPage
      .getByRole("button", { name: "Revisar y confirmar" })
      .click({ force: true });
    await openDetails(clientPage, "Pedir corrección");
    await clientPage
      .locator('textarea[name="correctionReason"]')
      .fill(
        "Por favor ajustar los márgenes móviles y el contraste del footer.",
      );
    await clientPage
      .getByRole("button", { name: "Enviar corrección" })
      .click({ force: true });

    await expect(clientPage.getByText("En curso").first()).toBeVisible({
      timeout: 15_000,
    });
    await captureScreenshot(clientPage, "09-model-b-correction-requested.png");

    // Provider 2 re-submits delivery with corrections
    await p2Page.reload();
    await expect(
      p2Page.locator('textarea[name="deliverySummary"]'),
    ).toBeVisible({ timeout: 15_000 });
    await p2Page
      .locator('textarea[name="deliverySummary"]')
      .fill(
        "Segunda entrega con correcciones de footer y márgenes móviles aplicadas.",
      );
    await p2Page
      .locator('input[name="deliveryEvidenceUrl"]')
      .fill("https://github.com/gabsvm/changas/tree/main");
    await p2Page
      .getByRole("button", { name: "Enviar para revisión" })
      .click({ force: true });
    await expect(
      p2Page.getByText(/esperando revisión|Pendiente de cierre/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Client confirms completion
    await clientPage.reload();
    await expect(
      clientPage.getByRole("button", { name: "Revisar y confirmar" }),
    ).toBeVisible({ timeout: 15_000 });
    await clientPage
      .getByRole("button", { name: "Revisar y confirmar" })
      .click({ force: true });
    const finalConfirmButton = clientPage.getByRole("button", {
      name: /Confirmar trabajo por/i,
    });
    await expect(finalConfirmButton).toBeVisible({ timeout: 15_000 });
    await finalConfirmButton.click({ force: true });

    await expect(clientPage.getByText("Completado").first()).toBeVisible({
      timeout: 15_000,
    });
    await clientPage.setViewportSize({ width: 390, height: 844 });
    await captureScreenshot(clientPage, "10-model-b-completed-mobile.png");
    await clientPage.setViewportSize({ width: 1280, height: 800 });

    // External money declaration & confirmation for remote job
    await p2Page.reload();
    await openDetails(p2Page, "Registrar dinero recibido");
    await p2Page.locator('input[name="amount"]').fill("50000");
    await p2Page.locator('select[name="method"]').selectOption("TRANSFERENCIA");
    await p2Page
      .getByRole("button", { name: "Enviar declaración" })
      .click({ force: true });

    await clientPage.reload();
    const confirmRemotePayment = clientPage.getByRole("button", {
      name: "Confirmar que lo pagué",
    });
    await expect(confirmRemotePayment).toBeVisible({ timeout: 15_000 });
    await confirmRemotePayment.click({ force: true });

    // Client leaves review for Provider 2
    await clientPage.locator('select[name="rating"]').selectOption("5");
    await clientPage
      .locator('textarea[name="reviewText"]')
      .fill("Excelente desarrollador, resolvió las correcciones al instante!");
    await clientPage
      .getByRole("button", { name: "Publicar reseña" })
      .click({ force: true });

    await expect(
      clientPage.getByText("Reseña verificada de este trabajo").first(),
    ).toBeVisible();
    await captureScreenshot(clientPage, "11-model-b-reviewed.png");

    console.log("[OK] Model B: Open Need (Remoto) completed successfully!");

    // Close contexts cleanly
    await clientCtx.close();
    await p1Ctx.close();
    await p2Ctx.close();

    // Final assertion: no critical uncaught page/console errors
    expect(consoleErrors).toEqual([]);
  });
});

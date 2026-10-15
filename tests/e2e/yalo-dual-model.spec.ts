import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import {
  assertSafeLocalTarget,
  validateLocalDatabaseUrl,
  validateLocalSupabaseUrl,
} from "../../packages/config/src/test-safety-guard.ts";

const localIp = "127.0.0.1";
const supabaseUrl = validateLocalSupabaseUrl(
  process.env.API_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    `http://${localIp}:54321`,
);
const serviceRoleKey =
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = validateLocalDatabaseUrl(
  process.env.DATABASE_URL ??
    `postgres://postgres:postgres@${localIp}:54322/postgres`,
);

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
      // Filter out benign static/favicon 404s and local realtime websocket handshakes
      if (
        !text.includes("favicon") &&
        !text.includes("manifest.webmanifest") &&
        !text.includes("status of 404") &&
        !text.includes("WebSocket connection") &&
        !text.includes("realtime")
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

test.describe("YALO Dual Model Validation Suite (PR #29)", () => {
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    // Barrera de seguridad fail-closed obligatoria
    await assertSafeLocalTarget({
      supabaseUrl,
      databaseUrl: dbUrl,
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 1: MODELO A1 — RESERVA DIRECTA PREAUTORIZADA (INSTANT BOOKING)
  // ---------------------------------------------------------------------------
  test("Modelo A1 - Reserva directa preautorizada con slot instantáneo", async ({
    browser,
  }) => {
    const { dbUrl } = requireCredentials();
    const runId = Math.random().toString(16).slice(2, 8);
    const consoleErrors: string[] = [];

    const clientUser = await createAuthUser(
      `c-inst-${runId}`,
      "Cliente Directo",
    );
    const providerUser = await createAuthUser(
      `p-inst-${runId}`,
      "Prestador Instantáneo",
    );

    const pSlug = `p-inst-${runId}`;
    const sSlug = `cerrajeria-instant-${runId}`;

    const db = new pg.Client({ connectionString: dbUrl });
    await db.connect();

    try {
      const skillsRes = await db.query(
        "SELECT id FROM skills WHERE is_active ORDER BY sort_order, id LIMIT 1",
      );
      const skillId = skillsRes.rows[0].id;

      await db.query(
        `INSERT INTO provider_profiles (user_id, status, onboarding_step, public_slug, public_headline)
         VALUES ($1, 'ACTIVE', 4, $2, 'Cerrajero de Guardia')
         ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE', marketplace_paused = false;`,
        [providerUser.id, pSlug],
      );

      await db.query(
        `INSERT INTO provider_skills (provider_user_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [providerUser.id, skillId],
      );

      // Servicio con instant_booking_enabled = true
      await db.query(
        `INSERT INTO services (
          id, provider_user_id, skill_id, public_slug, title, description,
          modality, price_model, price_amount, currency_code, accepts_offers,
          schedule_type, is_published, is_paused, instant_booking_enabled
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 'Cerrajería Apertura Inmediata',
          'Servicio de apertura con confirmación directa preautorizada.',
          'IN_PERSON', 'FIXED', 2000000, 'ARS', false,
          'FIXED_SLOT', true, false, true
        );`,
        [providerUser.id, skillId, sSlug],
      );
    } finally {
      await db.end();
    }

    const clientCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const clientPage = await clientCtx.newPage();
    attachErrorListeners(clientPage, "Client-Instant", consoleErrors);

    await loginUser(clientPage, clientUser.email, clientUser.pass);

    // Navegar al servicio con instant booking
    await clientPage.goto(`/p/${pSlug}/${sSlug}`);
    await expect(
      clientPage.getByRole("heading", {
        name: "Cerrajería Apertura Inmediata",
      }),
    ).toBeVisible();

    // Comprobar que el CTA indica "Consultar disponibilidad y reservar" (D2 SPEC v1.0)
    const instantCta = clientPage.getByRole("button", {
      name: /consultar disponibilidad y reservar/i,
    });
    await expect(instantCta).toBeVisible();
    await captureScreenshot(
      clientPage,
      "01-model-a1-instant-booking-service.png",
    );

    await instantCta.click();
    await expect(clientPage).toHaveURL(/\/messages\/[0-9a-f-]{36}/i);
    await captureScreenshot(clientPage, "02-model-a1-instant-conversation.png");

    await clientCtx.close();
    expect(consoleErrors).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // TEST 2: MODELO A2 — CONTRATACIÓN NEGOCIADA Y CICLO COMPLETO CON PIN
  // ---------------------------------------------------------------------------
  test("Modelo A2 - Contratación negociada y entrega presencial completa con PIN", async ({
    browser,
  }) => {
    const { dbUrl } = requireCredentials();
    const runId = Math.random().toString(16).slice(2, 8);
    const consoleErrors: string[] = [];

    const clientUser = await createAuthUser(
      `c-neg-${runId}`,
      "Cliente Presencial",
    );
    const providerUser = await createAuthUser(
      `p-neg-${runId}`,
      "Prestador Presencial",
    );

    const pSlug = `p-neg-${runId}`;
    const sSlug = `cerrajeria-negociada-${runId}`;

    const db = new pg.Client({ connectionString: dbUrl });
    await db.connect();

    try {
      const skillsRes = await db.query(
        "SELECT id FROM skills WHERE is_active ORDER BY sort_order, id LIMIT 1",
      );
      const skillId = skillsRes.rows[0].id;

      await db.query(
        `INSERT INTO provider_profiles (user_id, status, onboarding_step, public_slug, public_headline)
         VALUES ($1, 'ACTIVE', 4, $2, 'Cerrajería Profesional 24hs')
         ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE', marketplace_paused = false;`,
        [providerUser.id, pSlug],
      );

      await db.query(
        `INSERT INTO provider_skills (provider_user_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [providerUser.id, skillId],
      );

      // instant_booking_enabled = false (Negociación obligatoria)
      await db.query(
        `INSERT INTO services (
          id, provider_user_id, skill_id, public_slug, title, description,
          modality, price_model, price_amount, currency_code, accepts_offers,
          schedule_type, is_published, is_paused, instant_booking_enabled
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 'Cerrajería y Apertura de Emergencia',
          'Apertura técnica y cambio de cerraduras con presupuesto acordado.',
          'IN_PERSON', 'FIXED', 1500000, 'ARS', false,
          'UNSCHEDULED', true, false, false
        );`,
        [providerUser.id, skillId, sSlug],
      );
    } finally {
      await db.end();
    }

    const clientCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const pCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    const clientPage = await clientCtx.newPage();
    const pPage = await pCtx.newPage();

    attachErrorListeners(clientPage, "Client-Neg", consoleErrors);
    attachErrorListeners(pPage, "Provider-Neg", consoleErrors);

    await loginUser(clientPage, clientUser.email, clientUser.pass);
    await loginUser(pPage, providerUser.email, providerUser.pass);

    // 1. Cliente solicita cotización
    await clientPage.goto(`/p/${pSlug}/${sSlug}`);
    const quoteButton = clientPage.getByRole("button", {
      name: /pedir cotización/i,
    });
    await expect(quoteButton).toBeVisible();
    await quoteButton.click();

    await expect(clientPage).toHaveURL(/\/messages\/[0-9a-f-]{36}/i);
    const convId = clientPage.url().match(/\/messages\/([0-9a-f-]{36})/i)![1];

    // 2. Prestador envía propuesta
    await pPage.goto(`/messages/${convId}`);
    await openDetails(pPage, /Enviar una cotización|Proponer un acuerdo/);
    const proposalForm = pPage.locator("form").filter({
      has: pPage.getByRole("button", { name: "Enviar propuesta" }),
    });
    await proposalForm.locator('input[name="price"]').fill("15000");
    await proposalForm
      .locator('textarea[name="scope"]')
      .fill("Apertura técnica y cambio de perno.");
    await proposalForm.evaluate((form: HTMLFormElement) =>
      form.requestSubmit(),
    );
    await expect(
      pPage.getByText("Propuesta creada.", { exact: true }),
    ).toBeVisible();

    // 3. Cliente acepta y contrata
    await clientPage.reload();
    await expect(
      clientPage.getByText("Apertura técnica y cambio de perno.").first(),
    ).toBeVisible();
    await clientPage
      .getByRole("button", { name: "Contratar" })
      .click({ force: true });
    await clientPage
      .getByRole("button", { name: "Confirmar contratación" })
      .click({ force: true });

    await expect(
      clientPage.getByText(/ya tiene un servicio en marcha/i),
    ).toBeVisible({ timeout: 15_000 });
    const jobLink = clientPage.getByRole("link", { name: "Ver seguimiento →" });
    const jobHref = await jobLink.getAttribute("href");
    const jobId = jobHref!.split("/jobs/")[1];

    // 4. Prestador inicia trabajo
    await pPage.goto(`/jobs/${jobId}`);
    await pPage
      .getByRole("button", { name: "Iniciar trabajo" })
      .click({ force: true });
    await expect(pPage.locator('textarea[name="deliverySummary"]')).toBeVisible(
      { timeout: 15_000 },
    );

    // 5. Prestador envía entrega presencial
    await pPage
      .locator('textarea[name="deliverySummary"]')
      .fill("Cerradura abierta correctamente.");
    await pPage
      .getByRole("button", { name: "Enviar para revisión" })
      .click({ force: true });
    await expect(pPage.locator('input[name="confirmationCode"]')).toBeVisible({
      timeout: 15_000,
    });

    // 6. Cliente ve el PIN de 4 dígitos
    await clientPage.goto(`/jobs/${jobId}`);
    const pinEl = clientPage.locator('[aria-label^="PIN de entrega"]');
    await expect(pinEl).toBeVisible({ timeout: 15_000 });
    const ariaLabel = await pinEl.getAttribute("aria-label");
    const pinText = (
      ariaLabel
        ? ariaLabel.replace(/\D/g, "")
        : (await pinEl.innerText()).replace(/\D/g, "")
    ).trim();
    expect(pinText).toMatch(/^\d{4}$/);

    // 7. Prestador valida PIN presencial
    await pPage.locator('input[name="confirmationCode"]').fill(pinText);
    await pPage
      .getByRole("button", { name: "Dejar constancia de entrega" })
      .click({ force: true });
    await expect(
      pPage.locator('input[name="confirmationCode"]'),
    ).not.toBeVisible({ timeout: 15_000 });

    // 8. Cierre bilateral del cliente
    await clientPage.reload();
    await clientPage
      .getByRole("button", { name: "Revisar y confirmar" })
      .click({ force: true });
    const confirmFinal = clientPage.getByRole("button", {
      name: /Confirmar trabajo por/i,
    });
    await confirmFinal.click({ force: true });
    await expect(clientPage.getByText("Completado").first()).toBeVisible({
      timeout: 15_000,
    });
    await captureScreenshot(clientPage, "03-model-a2-presencial-completed.png");

    // 9. Declaración y confirmación de pago externo
    await pPage.reload();
    await openDetails(pPage, "Registrar dinero recibido");
    await pPage.locator('input[name="amount"]').fill("15000");
    await pPage.locator('select[name="method"]').selectOption("TRANSFERENCIA");
    await pPage
      .getByRole("button", { name: "Enviar declaración" })
      .click({ force: true });

    await clientPage.reload();
    await clientPage
      .getByRole("button", { name: "Confirmar que lo pagué" })
      .click({ force: true });
    await expect(
      clientPage.getByText("$0", { exact: false }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // 10. Reseña 5 estrellas
    await clientPage.reload();
    const ratingSelect = clientPage.locator('select[name="rating"]');
    await expect(ratingSelect).toBeVisible({ timeout: 15_000 });
    await ratingSelect.selectOption("5");
    await clientPage
      .locator('textarea[name="reviewText"]')
      .fill("Excelente cerrajero presencial!");
    await clientPage
      .getByRole("button", { name: "Publicar reseña" })
      .click({ force: true });
    await expect(
      clientPage.getByText("Reseña verificada de este trabajo").first(),
    ).toBeVisible({ timeout: 15_000 });

    await clientCtx.close();
    await pCtx.close();
    expect(consoleErrors).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // TEST 3: MODELO B — NECESIDAD PÚBLICA CON COMPARADOR MULTI-OFERTA (2 OFERTAS)
  // ---------------------------------------------------------------------------
  test("Modelo B - Comparador multi-oferta (2 candidatos) y adjudicación única", async ({
    browser,
  }) => {
    const { dbUrl } = requireCredentials();
    const runId = Math.random().toString(16).slice(2, 8);
    const consoleErrors: string[] = [];

    const clientUser = await createAuthUser(`c-rfq-${runId}`, "Cliente RFQ");
    const p1User = await createAuthUser(`p1-rfq-${runId}`, "Candidato 1");
    const p2User = await createAuthUser(`p2-rfq-${runId}`, "Candidato 2");

    const p1Slug = `p1-rfq-${runId}`;
    const p2Slug = `p2-rfq-${runId}`;
    const s1Slug = `web-dev-1-${runId}`;
    const s2Slug = `web-dev-2-${runId}`;

    const db = new pg.Client({ connectionString: dbUrl });
    await db.connect();

    let remoteSkillId: string;
    try {
      const skillsRes = await db.query(
        "SELECT id FROM skills WHERE is_active ORDER BY sort_order, id LIMIT 1",
      );
      remoteSkillId = skillsRes.rows[0].id;

      // Provider 1 setup
      await db.query(
        `INSERT INTO provider_profiles (user_id, status, onboarding_step, public_slug, public_headline)
         VALUES ($1, 'ACTIVE', 4, $2, 'Candidato 1 Web')
         ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE', marketplace_paused = false;`,
        [p1User.id, p1Slug],
      );
      await db.query(
        `INSERT INTO provider_skills (provider_user_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [p1User.id, remoteSkillId],
      );
      await db.query(
        `INSERT INTO services (id, provider_user_id, skill_id, public_slug, title, description, modality, price_model, price_amount, currency_code, accepts_offers, schedule_type, is_published, is_paused)
         VALUES (gen_random_uuid(), $1, $2, $3, 'Desarrollo Web Frontend P1', 'Desarrollo de landing page y diseño web frontend profesional.', 'REMOTE', 'FIXED', 4500000, 'ARS', true, 'UNSCHEDULED', true, false);`,
        [p1User.id, remoteSkillId, s1Slug],
      );

      // Provider 2 setup
      await db.query(
        `INSERT INTO provider_profiles (user_id, status, onboarding_step, public_slug, public_headline)
         VALUES ($1, 'ACTIVE', 4, $2, 'Candidato 2 Web')
         ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE', marketplace_paused = false;`,
        [p2User.id, p2Slug],
      );
      await db.query(
        `INSERT INTO provider_skills (provider_user_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [p2User.id, remoteSkillId],
      );
      await db.query(
        `INSERT INTO services (id, provider_user_id, skill_id, public_slug, title, description, modality, price_model, price_amount, currency_code, accepts_offers, schedule_type, is_published, is_paused)
         VALUES (gen_random_uuid(), $1, $2, $3, 'Desarrollo Web Frontend P2', 'Desarrollo web a medida con Next.js y Tailwind CSS responsive.', 'REMOTE', 'FIXED', 5000000, 'ARS', true, 'UNSCHEDULED', true, false);`,
        [p2User.id, remoteSkillId, s2Slug],
      );
    } finally {
      await db.end();
    }

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

    attachErrorListeners(clientPage, "Client-RFQ", consoleErrors);
    attachErrorListeners(p1Page, "Provider1-RFQ", consoleErrors);
    attachErrorListeners(p2Page, "Provider2-RFQ", consoleErrors);

    await loginUser(clientPage, clientUser.email, clientUser.pass);
    await loginUser(p1Page, p1User.email, p1User.pass);
    await loginUser(p2Page, p2User.email, p2User.pass);

    // 1. Cliente publica necesidad vía Wizard móvil
    await clientPage.setViewportSize({ width: 390, height: 844 });
    await clientPage.goto("/needs/new");
    await clientPage
      .locator('select[name="skillId"]')
      .selectOption(remoteSkillId);
    await clientPage
      .locator('input[name="title"]')
      .fill("Creación de Landing Institucional Next.js");
    await clientPage
      .locator('textarea[name="description"]')
      .fill("Necesitamos maquetación responsive en Next.js con Tailwind.");
    await clientPage
      .getByRole("button", { name: "Continuar" })
      .click({ force: true });

    await clientPage.locator('input[name="locationText"]').fill("Remoto");
    await clientPage.locator('input[name="desiredBudgetAmount"]').fill("50000");
    await clientPage
      .getByRole("button", { name: "Continuar" })
      .click({ force: true });

    await clientPage
      .getByRole("button", { name: "Publicar necesidad" })
      .click({ force: true });
    await expect(clientPage).toHaveURL(/\/needs\/[0-9a-f-]{36}/i);
    const postId = clientPage.url().split("/needs/")[1];

    // 2. Prestador 1 envía oferta por $45.000
    await p1Page.goto(`/needs/${postId}`);
    await p1Page.locator('select[name="serviceId"]').selectOption({ index: 1 });
    await p1Page
      .getByRole("button", { name: "Ofertar en esta necesidad" })
      .click({ force: true });
    await expect(p1Page).toHaveURL(/\/messages\/[0-9a-f-]{36}/i);
    await openDetails(p1Page, /Enviar una cotización|Proponer un acuerdo/);
    const formP1 = p1Page
      .locator("form")
      .filter({
        has: p1Page.getByRole("button", { name: "Enviar propuesta" }),
      });
    await formP1.locator('input[name="price"]').fill("45000");
    await formP1
      .locator('textarea[name="scope"]')
      .fill("Oferta candidato 1 por $45.000 ARS.");
    await formP1.evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(
      p1Page.getByText("Propuesta creada.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // 3. Prestador 2 envía oferta por $50.000
    await p2Page.goto(`/needs/${postId}`);
    await p2Page.locator('select[name="serviceId"]').selectOption({ index: 1 });
    await p2Page
      .getByRole("button", { name: "Ofertar en esta necesidad" })
      .click({ force: true });
    await expect(p2Page).toHaveURL(/\/messages\/[0-9a-f-]{36}/i);
    await openDetails(p2Page, /Enviar una cotización|Proponer un acuerdo/);
    const formP2 = p2Page
      .locator("form")
      .filter({
        has: p2Page.getByRole("button", { name: "Enviar propuesta" }),
      });
    await formP2.locator('input[name="price"]').fill("50000");
    await formP2
      .locator('textarea[name="scope"]')
      .fill("Oferta candidato 2 por $50.000 ARS con componentes premium.");
    await formP2.evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(
      p2Page.getByText("Propuesta creada.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // 4. Cliente abre comparador en escritorio y ve "2 ofertas recibidas"
    await clientPage.setViewportSize({ width: 1280, height: 800 });
    await clientPage.goto(`/needs/${postId}`);
    await expect(
      clientPage.getByText("2 ofertas recibidas").first(),
    ).toBeVisible({ timeout: 15_000 });
    await captureScreenshot(clientPage, "04-model-b-comparator-2-offers.png");

    // 5. Cliente contrata a Prestador 2
    const compareCta = clientPage
      .getByRole("link", { name: "Ver oferta y contratar" })
      .last();
    const conversationHref = await compareCta.getAttribute("href");
    expect(conversationHref).toMatch(/\/messages\/[0-9a-f-]{36}/i);
    await clientPage.goto(conversationHref!);
    await expect(clientPage).toHaveURL(/\/messages\/[0-9a-f-]{36}/i);

    await clientPage
      .getByRole("button", { name: "Contratar" })
      .click({ force: true });
    await clientPage
      .getByRole("button", { name: "Confirmar contratación" })
      .click({ force: true });

    // Adjudicación confirmada
    await expect(
      clientPage.getByText(/ya tiene un servicio en marcha/i),
    ).toBeVisible({ timeout: 15_000 });
    await captureScreenshot(clientPage, "05-model-b-awarded-provider2.png");

    await clientCtx.close();
    await p1Ctx.close();
    await p2Ctx.close();
    expect(consoleErrors).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // TEST 4: ENTREGA REMOTA — VALIDACIÓN DE URL, CORRECCIÓN Y NO AUTOCIERRE
  // ---------------------------------------------------------------------------
  test("Entrega Remota - Validación estricta de URL HTTPS, corrección y no autocierre", async ({
    browser,
  }) => {
    const { dbUrl } = requireCredentials();
    const runId = Math.random().toString(16).slice(2, 8);
    const consoleErrors: string[] = [];

    const clientUser = await createAuthUser(`c-rem-${runId}`, "Cliente Remoto");
    const pUser = await createAuthUser(`p-rem-${runId}`, "Prestador Remoto");

    const pSlug = `p-rem-${runId}`;
    const sSlug = `dev-remote-${runId}`;

    const db = new pg.Client({ connectionString: dbUrl });
    await db.connect();

    let jobId: string;
    try {
      const skillsRes = await db.query(
        "SELECT id FROM skills WHERE is_active ORDER BY sort_order, id LIMIT 1",
      );
      const skillId = skillsRes.rows[0].id;

      await db.query(
        `INSERT INTO provider_profiles (user_id, status, onboarding_step, public_slug, public_headline)
         VALUES ($1, 'ACTIVE', 4, $2, 'Diseñador UI/UX')
         ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE', marketplace_paused = false;`,
        [pUser.id, pSlug],
      );
      await db.query(
        `INSERT INTO provider_skills (provider_user_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [pUser.id, skillId],
      );
      const servRes = await db.query(
        `INSERT INTO services (id, provider_user_id, skill_id, public_slug, title, description, modality, price_model, price_amount, currency_code, accepts_offers, schedule_type, is_published, is_paused)
         VALUES (gen_random_uuid(), $1, $2, $3, 'Diseño Figma y Maquetación', 'Servicio digital remoto.', 'REMOTE', 'FIXED', 3000000, 'ARS', true, 'UNSCHEDULED', true, false)
         RETURNING id;`,
        [pUser.id, skillId, sSlug],
      );

      // Crear conversación, propuesta y trabajo ya CONFIRMED
      const convRes = await db.query(
        `INSERT INTO conversations (id, service_id, client_user_id, provider_user_id)
         VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id;`,
        [servRes.rows[0].id, clientUser.id, pUser.id],
      );
      const convId = convRes.rows[0].id;

      await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [
        pUser.id,
      ]);
      const propRes = await db.query(
        `SELECT public.create_conversation_proposal(
          $1::uuid, 'PROVIDER_QUOTE'::public.proposal_kind, 'Diseño en Figma'::text, 3000000::bigint,
          null, null, null, null, gen_random_uuid()
        ) as id;`,
        [convId],
      );
      const propId = propRes.rows[0].id;

      await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [
        clientUser.id,
      ]);
      await db.query(
        `SELECT public.respond_to_proposal($1::uuid, 'ACCEPT', null);`,
        [propId],
      );
      const jobRes = await db.query(
        `SELECT id FROM public.jobs WHERE conversation_id = $1::uuid;`,
        [convId],
      );
      jobId = jobRes.rows[0].id;
    } finally {
      await db.end();
    }

    const clientCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const pCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    const clientPage = await clientCtx.newPage();
    const pPage = await pCtx.newPage();

    attachErrorListeners(clientPage, "Client-RemoteDelivery", consoleErrors);
    attachErrorListeners(pPage, "Provider-RemoteDelivery", consoleErrors);

    await loginUser(clientPage, clientUser.email, clientUser.pass);
    await loginUser(pPage, pUser.email, pUser.pass);

    // 1. Prestador inicia trabajo
    await pPage.goto(`/jobs/${jobId}`);
    await pPage
      .getByRole("button", { name: "Iniciar trabajo" })
      .click({ force: true });
    await expect(pPage.locator('textarea[name="deliverySummary"]')).toBeVisible(
      { timeout: 15_000 },
    );

    // 2. Intento de entrega inválida (rechazo de URL no HTTPS o malformada)
    await pPage
      .locator('textarea[name="deliverySummary"]')
      .fill("Entrega sin HTTPS");
    await pPage
      .locator('input[name="deliveryEvidenceUrl"]')
      .fill("http://untrusted-http-link.com");
    await pPage
      .getByRole("button", { name: "Enviar para revisión" })
      .click({ force: true });

    // Debe permanecer en formulario o mostrar error de validación HTTPS
    await expect(
      pPage.locator('input[name="deliveryEvidenceUrl"]'),
    ).toBeVisible();

    // 3. Prestador envía entrega válida con HTTPS
    await pPage
      .locator('input[name="deliveryEvidenceUrl"]')
      .fill(
        "https://github.com/gabsvm/changas/releases/v1.0.0/deliverable.zip",
      );
    await pPage
      .getByRole("button", { name: "Enviar para revisión" })
      .click({ force: true });
    await expect(
      pPage.getByText(/esperando revisión|Pendiente de cierre/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // 4. Cliente solicita corrección formal
    await clientPage.goto(`/jobs/${jobId}`);
    await clientPage
      .getByRole("button", { name: "Revisar y confirmar" })
      .click({ force: true });
    await openDetails(clientPage, "Pedir corrección");
    await clientPage
      .locator('textarea[name="correctionReason"]')
      .fill("Por favor ajustar colores corporativos y tipografía del footer.");
    await clientPage
      .getByRole("button", { name: "Enviar corrección" })
      .click({ force: true });

    // El trabajo vuelve a En curso (IN_PROGRESS)
    await expect(clientPage.getByText("En curso").first()).toBeVisible({
      timeout: 15_000,
    });
    await captureScreenshot(
      clientPage,
      "06-model-b-remote-correction-requested.png",
    );

    // 5. Prestador re-entrega corregido
    await pPage.reload();
    await expect(pPage.locator('textarea[name="deliverySummary"]')).toBeVisible(
      { timeout: 15_000 },
    );
    await pPage
      .locator('textarea[name="deliverySummary"]')
      .fill("Correcciones de colores y tipografía aplicadas en v1.0.1.");
    await pPage
      .locator('input[name="deliveryEvidenceUrl"]')
      .fill(
        "https://github.com/gabsvm/changas/releases/v1.0.1/deliverable-fixed.zip",
      );
    await pPage
      .getByRole("button", { name: "Enviar para revisión" })
      .click({ force: true });
    await expect(
      pPage.getByText(/esperando revisión|Pendiente de cierre/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // 6. Cliente confirma y finaliza
    await clientPage.reload();
    await clientPage
      .getByRole("button", { name: "Revisar y confirmar" })
      .click({ force: true });
    await clientPage
      .getByRole("button", { name: /Confirmar trabajo por/i })
      .click({ force: true });
    await expect(clientPage.getByText("Completado").first()).toBeVisible({
      timeout: 15_000,
    });
    await captureScreenshot(
      clientPage,
      "07-model-b-remote-approved-completed.png",
    );

    await clientCtx.close();
    await pCtx.close();
    expect(consoleErrors).toEqual([]);
  });
});

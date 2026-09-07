import { expect, test, type Page } from "@playwright/test";

const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

type TestUser = { id: string; email: string; password: string };

function requireAdminConfig() {
  if (!apiUrl || !serviceRoleKey) {
    throw new Error(
      "Mobile onboarding E2E requires local Supabase admin credentials.",
    );
  }
  return { apiUrl, serviceRoleKey };
}

async function createTestUser(width: number): Promise<TestUser> {
  const config = requireAdminConfig();
  const suffix = crypto.randomUUID();
  const email = `mobile-onboarding-${width}-${suffix}@example.test`;
  const password = `Mobile-${width}-${suffix}-Password!`;
  const response = await fetch(`${config.apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: `Mobile ${width}` },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Could not create mobile onboarding E2E user: ${response.status} ${await response.text()}`,
    );
  }

  const body = (await response.json()) as { id?: string };
  if (!body.id)
    throw new Error("Mobile onboarding E2E user response has no id.");
  return { id: body.id, email, password };
}

async function login(page: Page, user: TestUser) {
  await page.goto("/login?next=/account");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/account$/);
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

async function getMobileNavigation(page: Page) {
  return page.getByRole("navigation", { name: "Navegación principal" });
}

async function expectMobileNavigation(page: Page) {
  const nav = await getMobileNavigation(page);
  await expect(nav).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Cuenta", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  const navTargets = nav.getByRole("link");
  const count = await navTargets.count();
  expect(count).toBe(4);
  for (let index = 0; index < count; index += 1) {
    const box = await navTargets.nth(index).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
}

async function expectPrimaryActionAboveNavigation(page: Page, name: string) {
  const action = page.getByRole("button", { name, exact: true });
  await action.scrollIntoViewIfNeeded();

  const [actionBox, navBox] = await Promise.all([
    action.boundingBox(),
    (await getMobileNavigation(page)).boundingBox(),
  ]);

  expect(actionBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect((actionBox?.y ?? 0) + (actionBox?.height ?? 0)).toBeLessThanOrEqual(
    (navBox?.y ?? 0) - 4,
  );
}

async function expectMobileRoute(page: Page) {
  await expectNoHorizontalOverflow(page);
  await expectMobileNavigation(page);
  await expect(page.locator("main h1")).toHaveCount(1);

  const back = page.getByRole("link", { name: "Volver" });
  await expect(back).toBeVisible();
  const box = await back.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
}

for (const width of [320, 360, 390] as const) {
  test(`mobile account and provider onboarding remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const user = await createTestUser(width);
    await login(page, user);

    await expectNoHorizontalOverflow(page);
    await expectMobileNavigation(page);
    await page.getByRole("button", { name: "Empezar como proveedor" }).click();

    await expect(page).toHaveURL(/\/provider\/onboarding$/);
    await expect(
      page.getByRole("heading", { name: "Tu verificación" }),
    ).toBeVisible();
    await expectMobileRoute(page);

    await page.getByRole("link", { name: "Continuar verificación" }).click();
    await expect(page).toHaveURL(/\/provider\/onboarding\/profile$/);
    await expect(
      page.getByRole("heading", { name: "Prepará tu perfil público" }),
    ).toBeVisible();
    await expectMobileRoute(page);
    await expectPrimaryActionAboveNavigation(page, "Guardar datos básicos");

    await page.getByRole("button", { name: "Continuar con identidad" }).click();
    await expect(page).toHaveURL(/\/provider\/onboarding\/identity$/);
    await expect(
      page.getByRole("heading", { name: "Confirmá tus datos privados" }),
    ).toBeVisible();
    await expectMobileRoute(page);
    await expectPrimaryActionAboveNavigation(page, "Guardar identidad");

    await page
      .getByRole("button", { name: "Continuar con documentos" })
      .click();
    await expect(page).toHaveURL(/\/provider\/onboarding\/documents$/);
    await expect(
      page.getByRole("heading", { name: "Documentos de identidad" }),
    ).toBeVisible();
    await expectMobileRoute(page);

    await page.getByRole("button", { name: "Continuar a revisión" }).click();
    await expect(page).toHaveURL(/\/provider\/onboarding\/review$/);
    await expect(
      page.getByRole("heading", { name: "Revisá lo cargado" }),
    ).toBeVisible();
    await expect(page.getByText("Revisar", { exact: true })).toHaveCount(3);
    await expectMobileRoute(page);
  });
}

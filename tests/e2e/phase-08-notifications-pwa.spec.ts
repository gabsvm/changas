import { expect, test, type Page } from "@playwright/test";

const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

type TestUser = {
  id: string;
  email: string;
  password: string;
};

function requireAdminConfig() {
  if (!apiUrl || !serviceRoleKey) {
    throw new Error("Phase 08 E2E requires local Supabase admin credentials.");
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

async function createTestUser(displayName: string): Promise<TestUser> {
  const suffix = crypto.randomUUID();
  const email = `phase08-e2e-${suffix}@example.test`;
  const password = `Phase08-${suffix}-Password!`;
  const response = await adminRequest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Could not create Phase 08 E2E user: ${response.status} ${await response.text()}`,
    );
  }

  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error("Phase 08 E2E user response has no id.");
  return { id: body.id, email, password };
}

async function deleteTestUser(userId: string) {
  const response = await adminRequest(`/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(
      `Could not delete Phase 08 E2E user: ${response.status} ${await response.text()}`,
    );
  }
}

async function login(page: Page, user: TestUser, next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replaceAll("/", "\\/")}$`));
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

test.describe("Phase 08 notifications and PWA", () => {
  test("verification event appears unread, can be read and preferences persist", async ({
    page,
  }) => {
    const user = await createTestUser("Prestador E2E Phase 08");

    try {
      const createProvider = await adminRequest("/rest/v1/provider_profiles", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          status: "IDENTITY_PENDING",
          onboarding_step: 4,
        }),
      });
      expect(createProvider.ok).toBeTruthy();

      const approveProvider = await adminRequest(
        `/rest/v1/provider_profiles?user_id=eq.${user.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "ACTIVE" }),
        },
      );
      expect(approveProvider.ok).toBeTruthy();

      await login(page, user);
      await expect(
        page.getByLabel("1 notificaciones sin leer"),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.getByRole("link", { name: /Notificaciones/ }).click();
      await expect(page).toHaveURL(/\/account\/notifications$/);
      await expect(
        page.getByRole("heading", { name: "Notificaciones" }),
      ).toBeVisible();
      await expect(page.getByText("Verificación aprobada")).toBeVisible();
      await expect(
        page.getByText("Tu perfil de prestador ya está habilitado."),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.getByRole("button", { name: "Marcar como leída" }).click();
      await expect(page.getByText("Leída", { exact: true })).toBeVisible();
      await expect(page.getByLabel("1 notificaciones sin leer")).toHaveCount(0);

      const promotional = page.locator('input[name="promotionalEnabled"]');
      await expect(promotional).not.toBeChecked();
      await promotional.check();
      await page.getByRole("button", { name: "Guardar preferencias" }).click();
      await expect(page.getByRole("status")).toContainText(
        "Preferencias actualizadas.",
      );
      await page.reload();
      await expect(promotional).toBeChecked();
      await expectNoHorizontalOverflow(page);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("denied push permission never prompts automatically and does not block authenticated navigation", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: {
          permission: "denied",
          requestPermission: () => {
            const target = window as typeof window & {
              __phase08NotificationPromptCalls?: number;
            };
            target.__phase08NotificationPromptCalls =
              (target.__phase08NotificationPromptCalls ?? 0) + 1;
            return Promise.resolve("denied");
          },
        },
      });
      const target = window as typeof window & {
        __phase08NotificationPromptCalls?: number;
      };
      target.__phase08NotificationPromptCalls = 0;
    });

    const user = await createTestUser("Usuario Push Denegado Phase 08");

    try {
      await login(page, user, "/account/notifications");
      await expect(
        page.getByText(/El navegador tiene bloqueado el permiso/),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Activar notificaciones push" }),
      ).toBeDisabled();
      expect(
        await page.evaluate(
          () =>
            (
              window as typeof window & {
                __phase08NotificationPromptCalls?: number;
              }
            ).__phase08NotificationPromptCalls ?? 0,
        ),
      ).toBe(0);

      await page.goto("/jobs");
      await expect(page).toHaveURL(/\/jobs$/);
      await expect(page.getByRole("link", { name: "Notificaciones" })).toBeVisible();

      await page.goto("/messages");
      await expect(page).toHaveURL(/\/messages$/);
      await expect(page.getByRole("link", { name: "Notificaciones" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("manifest, service worker registration and offline shell expose the safe PWA contract", async ({
    page,
  }) => {
    await page.goto("/");

    const manifest = await page.evaluate(async () => {
      const response = await fetch("/manifest.webmanifest");
      return (await response.json()) as {
        display?: string;
        icons?: Array<{ sizes?: string }>;
      };
    });
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons?.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(manifest.icons?.some((icon) => icon.sizes === "512x512")).toBe(true);

    await expect
      .poll(async () =>
        page.evaluate(async () => {
          if (!("serviceWorker" in navigator)) return false;
          const registration = await navigator.serviceWorker.getRegistration();
          const worker =
            registration?.active ?? registration?.waiting ?? registration?.installing;
          return worker?.scriptURL.endsWith("/sw.js") ?? false;
        }),
      )
      .toBe(true);

    await page.goto("/offline");
    await expect(
      page.getByRole("heading", {
        name: "Changas necesita internet para mostrar datos actualizados.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/No mostramos trabajos, pagos, mensajes ni datos privados/),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

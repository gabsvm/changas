import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectPublicPageBasics(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("lang", /^es(?:-|$)/i);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).not.toBeEmpty();
  await expectNoHorizontalOverflow(page);
}

test.describe("Phase 10 beta hardening", () => {
  test("health endpoint is uncached and exposes only bounded deployment metadata", async ({
    request,
  }) => {
    const response = await request.get("/health");
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["cache-control"]).toContain("no-store");

    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      service: "changas-web",
      mode: "liveness",
    });
    expect(Object.keys(body).sort()).toEqual(
      ["environment", "mode", "revision", "service", "status", "timestamp"].sort(),
    );
    expect(JSON.stringify(body)).not.toMatch(/service[_-]?role|password|secret|token/i);
  });

  test("critical public marketplace pages keep semantic/mobile invariants", async ({
    page,
  }) => {
    for (const route of [
      "/",
      "/buscar",
      "/p/demo-proveedor",
      "/p/demo-proveedor/demo-revision-pc",
    ]) {
      await page.goto(route);
      await expectPublicPageBasics(page);
    }
  });

  test("login remains keyboard-addressable with explicit form labels", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Iniciar sesión" }),
    ).toBeEnabled();

    await page.keyboard.press("Tab");
    const activeTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeTag).not.toBe("BODY");
    await expectNoHorizontalOverflow(page);
  });
});

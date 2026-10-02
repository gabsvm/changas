import { expect, test, type Page } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 700 },
  { width: 360, height: 780 },
  { width: 390, height: 844 },
]) {
  test.describe(`marketplace app-first ${viewport.width}px`, () => {
    test.use({ viewport });

    test("home and search stay browseable without horizontal overflow", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Encontrá a alguien que lo haga." }),
      ).toBeVisible();
      await expect(
        page.getByRole("searchbox", { name: "Buscar un servicio o habilidad" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /remoto/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Tecnología" }).first(),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);

      await page.goto("/buscar?q=clases+ingles");
      await expect(
        page.getByRole("heading", { name: /Resultados para/ }),
      ).toBeVisible();

      const locationTrigger = page.getByRole("button", {
        name: "Usar ubicación",
      });
      await locationTrigger.click();
      const locationDialog = page.getByRole("dialog", {
        name: "¿Dónde estás buscando?",
      });
      await expect(locationDialog).toBeVisible();
      const locationClose = locationDialog.getByRole("button", {
        name: "Cerrar selector de ubicación",
      });
      await expect(locationClose).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(locationDialog.getByRole("combobox")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(locationClose).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(locationDialog).toBeHidden();
      await expect(locationTrigger).toBeFocused();

      await expect(page.getByRole("article").first()).toBeVisible();
      await page.getByRole("button", { name: "Filtros" }).click();
      const sheet = page.getByRole("dialog", { name: "Filtros" });
      await expect(sheet).toBeVisible();
      await expect(
        sheet.getByRole("heading", { name: "Filtros" }),
      ).toBeVisible();
      await expect(sheet.getByLabel("Modalidad")).toBeVisible();
      await expect(
        sheet.getByRole("button", { name: "Cerrar Filtros" }),
      ).toBeFocused();
      await expect
        .poll(() =>
          sheet
            .locator("[data-motion-panel]")
            .evaluate((element) => element.getAnimations().length),
        )
        .toBeGreaterThan(0);
      await page.keyboard.press("Shift+Tab");
      await expect(
        sheet.getByRole("button", { name: "Ver resultados" }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        sheet.getByRole("button", { name: "Cerrar Filtros" }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(page.getByRole("button", { name: "Filtros" })).toBeFocused();
      await assertNoHorizontalOverflow(page);
    });
  });
}

test("discovery filters do not animate when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/buscar?q=clases+ingles");
  await page.getByRole("button", { name: "Filtros" }).click();

  // The dialog element itself is the animated panel.
  const sheet = page.getByRole("dialog", { name: "Filtros" });
  await expect(sheet).toBeVisible();
  await expect
    .poll(() => sheet.evaluate((element) => element.getAnimations().length))
    .toBe(0);
});

async function assertNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

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
        page.getByRole("searchbox", { name: "Buscar un servicio o habilidad" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Tecnología" }).first(),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);

      await page.goto("/buscar?q=clases+ingles");
      await expect(
        page.getByRole("heading", { name: /Resultados para/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Filtros" }).click();
      const sheet = page.getByRole("dialog", { name: "Filtros" });
      await expect(sheet).toBeVisible();
      await expect(
        sheet.getByRole("heading", { name: "Filtros" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await assertNoHorizontalOverflow(page);
    });
  });
}

async function assertNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

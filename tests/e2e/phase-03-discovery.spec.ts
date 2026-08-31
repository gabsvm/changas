import { expect, test } from "@playwright/test";

test.describe("Phase 03 public discovery", () => {
  test("anonymous visitor can browse the marketplace home", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "¿Qué necesitás?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "Buscá por servicio o habilidad" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver servicios remotos" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Tecnología" })).toBeVisible();
  });

  test("search returns a required discovery example", async ({ page }) => {
    await page.goto("/buscar?q=electricista");
    await expect(
      page.getByRole("heading", { name: /Resultados para/ }),
    ).toBeVisible();
    await expect(
      page.getByText("Electricista", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Instalación eléctrica del hogar" }),
    ).toBeVisible();
  });

  test("remote filters remain useful without a location", async ({ page }) => {
    await page.goto("/buscar?q=clases+ingles&mode=remoto");
    await expect(
      page.getByRole("heading", { name: /clases ingles/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Clases de inglés conversacional" }),
    ).toBeVisible();
    await expect(
      page.getByText("Remoto", { exact: true }).first(),
    ).toBeVisible();
  });

  test("category browsing opens active technology results", async ({
    page,
  }) => {
    await page.goto("/categoria/tecnologia");
    await expect(
      page.getByRole("heading", { name: "Tecnología" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Revisión de PC a distancia" }),
    ).toBeVisible();
  });

  test("public provider and service pages remain shareable", async ({
    page,
  }) => {
    await page.goto("/p/demo-proveedor");
    await expect(
      page.getByRole("heading", { name: "Demo Proveedor" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Revisión de PC a distancia" })
      .click();
    await expect(page).toHaveURL(/\/p\/demo-proveedor\/demo-revision-pc$/);
    await expect(
      page.getByRole("heading", { name: "Revisión de PC a distancia" }),
    ).toBeVisible();
  });

  test("favorite action sends an anonymous visitor through auth safely", async ({
    page,
  }) => {
    await page.goto("/p/demo-proveedor");
    await page.getByRole("button", { name: "Guardar proveedor" }).click();
    await expect(page).toHaveURL(/\/login\?next=.*%2Fp%2Fdemo-proveedor/);
  });
});

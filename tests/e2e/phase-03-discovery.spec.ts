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
    await expect(
      page.getByRole("link", { name: "Tecnología" }).first(),
    ).toBeVisible();
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
      page.locator("article").getByText("Remoto", { exact: true }).first(),
    ).toBeVisible();
  });

  test("URL-addressable filters narrow public results", async ({ page }) => {
    await page.goto(
      "/buscar?category=tecnologia&skill=soporte-tecnico-remoto&priceModel=STARTING_AT&min=8000&max=10000&offers=true",
    );
    await expect(
      page.getByRole("link", { name: "Soporte técnico remoto" }),
    ).toBeVisible();
    await expect(page.locator("#search-category")).toHaveValue("tecnologia");
    await expect(page.locator("#search-skill")).toHaveValue(
      "soporte-tecnico-remoto",
    );
    await expect(page.locator("#search-price-model")).toHaveValue(
      "STARTING_AT",
    );
    await expect(page.locator("#search-min")).toHaveValue("8000");
    await expect(page.locator("#search-max")).toHaveValue("10000");
    await expect(page.locator("#search-offers")).toBeChecked();
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

  test("pagination preserves public filters and uses real page state", async ({
    page,
  }) => {
    await page.goto("/buscar?category=tecnologia&pageSize=1");
    await expect(page.getByRole("link", { name: "Siguiente" })).toBeVisible();
    await page.getByRole("link", { name: "Siguiente" }).click();
    await expect(page).toHaveURL(
      /\/buscar\?category=tecnologia&pageSize=1&page=2/,
    );
    await expect(page.getByRole("link", { name: "Anterior" })).toBeVisible();
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

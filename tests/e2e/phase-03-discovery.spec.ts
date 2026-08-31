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

  test("GPS discovery paginates in memory without putting coordinates in URL", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: -34.58, longitude: -58.43 });
    let requestedPage = 0;
    await page.route("**/api/discovery", async (route) => {
      requestedPage = (await route.request().postDataJSON()).filters.page;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          hasMore: requestedPage === 1,
          rows: [
            {
              provider_display_name: "GPS Provider",
              provider_avatar_url: null,
              provider_slug: "gps-provider",
              provider_zone: "Palermo",
              service_title: "Servicio GPS " + requestedPage,
              service_slug: "gps-service-" + requestedPage,
              category_slug: "tecnologia",
              category_name: "Tecnología",
              skill_slug: "soporte-tecnico-remoto",
              skill_name: "Soporte técnico remoto",
              modality: "BOTH",
              price_model: "FIXED",
              price_amount: 900000,
              currency_code: "ARS",
              price_unit: null,
              accepts_offers: false,
              distance_bucket: "KM_2_TO_5",
              relevance: 1,
              has_more: requestedPage === 1,
            },
          ],
        }),
      });
    });
    await page.goto("/buscar?category=tecnologia&pageSize=1");
    await page.getByRole("button", { name: "Buscar cerca mío" }).click();
    await expect(
      page.getByRole("heading", { name: /Servicio GPS 1/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(
      page.getByRole("heading", { name: /Servicio GPS 2/ }),
    ).toBeVisible();
    expect(requestedPage).toBe(2);
    expect(page.url()).not.toContain("34.58");
    await page.getByRole("button", { name: "Anterior" }).click();
    await expect(
      page.getByRole("heading", { name: /Servicio GPS 1/ }),
    ).toBeVisible();
  });
});

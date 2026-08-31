import { expect, test } from "@playwright/test";

test.describe("Phase 02 mobile web smoke", () => {
  test("provider management requires an authenticated session", async ({
    page,
  }) => {
    await page.goto("/provider/manage");
    await expect(page).toHaveURL(
      /\/login\?next=(?:%2F|\/)provider(?:%2F|\/)manage$/,
    );
    await expect(
      page.getByRole("heading", { name: "Volvé a Changas" }),
    ).toBeVisible();
  });

  test("public provider page renders the seeded active provider without a fake badge", async ({
    page,
  }) => {
    await page.goto("/p/demo-proveedor");
    await expect(
      page.getByRole("heading", { name: "Demo Proveedor" }),
    ).toBeVisible();
    await expect(page.getByText("Proveedor verificado")).toHaveCount(0);
    await expect(page.getByText("Perfil activo")).toBeVisible();
  });

  test("public service page is isolated to the provider slug", async ({
    page,
  }) => {
    await page.goto("/p/demo-proveedor/demo-revision-pc");
    await expect(
      page.getByRole("heading", { name: "Revisión de PC a distancia" }),
    ).toBeVisible();
    await expect(page.getByText("$12.500")).toBeVisible();
  });
});

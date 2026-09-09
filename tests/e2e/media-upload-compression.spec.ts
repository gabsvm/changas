import { expect, test, type Page } from "@playwright/test";

const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminHeaders() {
  if (!apiUrl || !serviceRoleKey) {
    throw new Error("Media E2E requires local Supabase admin credentials.");
  }
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function createUser() {
  const suffix = crypto.randomUUID();
  const email = `media-e2e-${suffix}@example.test`;
  const password = `Media-${suffix}-Password!`;
  const response = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  expect(response.ok).toBeTruthy();
  const body = (await response.json()) as { id: string };
  return { id: body.id, email, password };
}

async function deleteUser(id: string) {
  await fetch(`${apiUrl}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
}

async function prepareProvider(id: string) {
  const headers = { ...adminHeaders(), Prefer: "return=minimal" };
  for (const [path, body] of [
    [
      `/rest/v1/profiles?id=eq.${id}`,
      {
        display_name: "Prestador Media E2E",
        public_zone: "CABA",
        bio: "Perfil sintético para validar compresión.",
      },
    ],
    [
      `/rest/v1/profile_private?user_id=eq.${id}`,
      {
        legal_name: "Prestador Media E2E",
        private_phone: "+54 11 5555 0101",
        date_of_birth: "1990-01-01",
        exact_address: "Dirección sintética 123",
        dni_number: "30111222",
      },
    ],
  ] as const) {
    const response = await fetch(`${apiUrl}${path}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    expect(response.ok).toBeTruthy();
  }
  const response = await fetch(`${apiUrl}/rest/v1/provider_profiles`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: id,
      status: "PROFILE_INCOMPLETE",
      onboarding_step: 3,
    }),
  });
  expect(response.ok).toBeTruthy();
}

async function browserFixture(
  page: Page,
  width: number,
  height: number,
  quality: number,
  mimeType = "image/jpeg",
) {
  return page.evaluate(
    async ({ width, height, quality, mimeType }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      const image = context.createImageData(width, height);
      for (let index = 0; index < image.data.length; index += 4) {
        const pixel = index / 4;
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        image.data[index] = (x * 17 + y * 13) % 256;
        image.data[index + 1] = (x * 7 + y * 19) % 256;
        image.data[index + 2] = (x * 23 + y * 5) % 256;
        image.data[index + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((value) => resolve(value!), mimeType, quality),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return {
        name: `${width}x${height}.jpg`,
        mimeType: blob.type,
        size: blob.size,
        base64: btoa(binary),
      };
    },
    { width, height, quality, mimeType },
  );
}

async function selectedFileInfo(page: Page) {
  return page.locator('input[name="document"]').evaluate(async (input) => {
    const file = (input as HTMLInputElement).files?.[0];
    if (!file) return null;
    const bitmap = await createImageBitmap(file);
    const result = {
      type: file.type,
      size: file.size,
      width: bitmap.width,
      height: bitmap.height,
    };
    bitmap.close();
    return result;
  });
}

test("compresses large identity photos before Server Action and Storage", async ({
  page,
}) => {
  const user = await createUser();
  try {
    await prepareProvider(user.id);
    await page.goto("/login?next=/provider/onboarding/documents");
    await page.getByLabel("Correo electrónico").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL("/provider/onboarding/documents");

    const fixtures = [
      await browserFixture(page, 1200, 900, 0.9),
      await browserFixture(page, 2400, 1800, 0.92),
      await browserFixture(page, 3024, 4032, 0.92),
    ];
    console.log(
      "MEDIA_FIXTURES",
      fixtures.map(({ name, size }) => ({ name, size })),
    );
    expect(fixtures[0]!.size).toBeGreaterThan(400 * 1024);
    expect(fixtures[1]!.size).toBeGreaterThan(1024 * 1024);
    expect(fixtures[2]!.size).toBeGreaterThan(2 * 1024 * 1024);

    for (const [index, fixture] of fixtures.entries()) {
      await page.locator('input[name="document"]').setInputFiles({
        name: fixture.name,
        mimeType: fixture.mimeType,
        buffer: Buffer.from(fixture.base64, "base64"),
      });
      await expect(
        page.getByText(/Imagen optimizada|Imagen lista/),
      ).toBeVisible();
      const info = await selectedFileInfo(page);
      expect(info).toMatchObject({ type: "image/jpeg" });
      expect(Math.max(info!.width, info!.height)).toBeLessThanOrEqual(1200);
      expect(info!.size).toBeLessThanOrEqual(110 * 1024);
      if (index < 2) await page.getByRole("button", { name: "Quitar" }).click();
    }

    for (const mimeType of ["image/png", "image/webp"]) {
      const fixture = await browserFixture(page, 2400, 1800, 0.92, mimeType);
      await page.locator('input[name="document"]').setInputFiles({
        name: `format-${mimeType.split("/")[1]}.${mimeType.split("/")[1]}`,
        mimeType,
        buffer: Buffer.from(fixture.base64, "base64"),
      });
      await expect(
        page.getByText(/Imagen optimizada|Imagen lista/),
      ).toBeVisible();
      const info = await selectedFileInfo(page);
      expect(info).toMatchObject({ type: "image/jpeg" });
      expect(info!.size).toBeLessThanOrEqual(110 * 1024);
      await page.getByRole("button", { name: "Quitar" }).click();
    }

    await page.locator('input[name="document"]').setInputFiles({
      name: "unsupported.heic",
      mimeType: "image/heic",
      buffer: Buffer.from("not-a-decodable-heic"),
    });
    await expect(page.locator('p[role="alert"]').last()).toContainText(
      /decod|optimizar/i,
    );
    expect(
      await page
        .locator('input[name="document"]')
        .evaluate((input) => (input as HTMLInputElement).files?.length ?? 0),
    ).toBe(0);

    const requestSizes: number[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.headers()["next-action"]) {
        requestSizes.push(request.postDataBuffer()?.length ?? 0);
      }
    });

    for (const [index, documentType] of ["DNI_FRONT", "SELFIE"].entries()) {
      await page.getByLabel("Tipo de documento").selectOption(documentType);
      await page.locator('input[name="document"]').setInputFiles({
        name: `${documentType}.jpg`,
        mimeType: "image/jpeg",
        buffer: Buffer.from(fixtures[2]!.base64, "base64"),
      });
      await expect(
        page.getByRole("button", { name: "Subir documento privado" }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "Subir documento privado" })
        .click();
      await expect
        .poll(async () => {
          const response = await fetch(
            `${apiUrl}/rest/v1/provider_documents?user_id=eq.${user.id}&select=id`,
            { headers: adminHeaders() },
          );
          return ((await response.json()) as Array<{ id: string }>).length;
        })
        .toBe(index + 1);
    }

    expect(requestSizes.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...requestSizes)).toBeLessThan(1024 * 1024);

    const documentResponse = await fetch(
      `${apiUrl}/rest/v1/provider_documents?user_id=eq.${user.id}&select=document_type,mime_type,file_size_bytes,storage_path`,
      { headers: adminHeaders() },
    );
    const documents = (await documentResponse.json()) as Array<
      Record<string, unknown>
    >;
    expect(documents).toHaveLength(2);
    expect(
      documents.every((document) => document.mime_type === "image/jpeg"),
    ).toBe(true);
    expect(
      documents.every(
        (document) => Number(document.file_size_bytes) <= 110 * 1024,
      ),
    ).toBe(true);
    expect(
      documents.every((document) =>
        String(document.storage_path).startsWith(`${user.id}/`),
      ),
    ).toBe(true);
    expect(
      documents.every(
        (document) => !String(document.storage_path).includes("3024x4032"),
      ),
    ).toBe(true);
  } finally {
    await deleteUser(user.id);
  }
});

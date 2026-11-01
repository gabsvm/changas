import { beforeEach, describe, expect, it, vi } from "vitest";

const SKILL_ID = "123e4567-e89b-12d3-a456-426614174000";

// Mirrors supabase-js: `rpc` is a prototype method that depends on `this`.
class FakeSupabaseClient {
  hasPhoto = false;
  alreadyPublished = false;
  rest = {
    rpc: vi.fn(async () => ({
      data: [{ id: "service-1", public_slug: "reparacion-pc" }],
      error: null,
    })),
  };

  auth = {
    getUser: async () => ({ data: { user: { id: "user-1" } } }),
  };

  from(table?: string) {
    if (table === "services") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { is_published: this.alreadyPublished },
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    if (table === "portfolio_items") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              not: () => ({
                limit: async () => ({
                  data: this.hasPhoto ? [{ id: "photo" }] : [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "provider_skills") {
      return { upsert: async () => ({ error: null }) };
    }
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { user_id: "user-1" } }),
        }),
      }),
    };
  }

  rpc(fn: string, args: unknown) {
    return (this.rest.rpc as (fn: string, args: unknown) => unknown)(fn, args);
  }
}

const client = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => client,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveServiceTransactional } from "./service-actions";

function form(): FormData {
  const data = new FormData();
  data.set("skillId", SKILL_ID);
  data.set("title", "Reparación de PC a domicilio");
  data.set(
    "description",
    "Diagnóstico completo y reparación de computadoras a domicilio.",
  );
  data.set("modality", "IN_PERSON");
  data.set("priceModel", "FIXED");
  data.set("priceAmount", "30000");
  data.set("scheduleType", "UNSCHEDULED");
  return data;
}

describe("saveServiceTransactional", () => {
  beforeEach(() => {
    client.rest.rpc.mockClear();
    client.hasPhoto = false;
    client.alreadyPublished = false;
  });

  it("permite guardar un borrador sin foto pero bloquea su publicación", async () => {
    const draft = form();
    expect(await saveServiceTransactional({}, draft)).toEqual({
      success: "Servicio y tags guardados.",
    });
    client.rest.rpc.mockClear();
    draft.set("isPublished", "on");
    expect((await saveServiceTransactional({}, draft)).error).toContain(
      "foto pública",
    );
    expect(client.rest.rpc).not.toHaveBeenCalled();
  });

  it("permite publicar con foto y editar un servicio publicado anteriormente", async () => {
    const data = form();
    data.set("isPublished", "on");
    client.hasPhoto = true;
    expect((await saveServiceTransactional({}, data)).success).toBeDefined();
    data.set("serviceId", "service-1");
    client.hasPhoto = false;
    client.alreadyPublished = true;
    expect((await saveServiceTransactional({}, data)).success).toBeDefined();
    client.alreadyPublished = false;
    expect((await saveServiceTransactional({}, data)).error).toContain(
      "foto pública",
    );
  });

  it("calls save_service_with_tags without losing the client binding", async () => {
    const result = await saveServiceTransactional({}, form());

    expect(result).toEqual({ success: "Servicio y tags guardados." });
    expect(client.rest.rpc).toHaveBeenCalledWith(
      "save_service_with_tags",
      expect.objectContaining({ requested_skill_id: SKILL_ID }),
    );
  });
});

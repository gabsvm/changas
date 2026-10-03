import { beforeEach, describe, expect, it, vi } from "vitest";

const SKILL_ID = "123e4567-e89b-12d3-a456-426614174000";

// Mirrors supabase-js: `rpc` is a prototype method that depends on `this`.
class FakeSupabaseClient {
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
  beforeEach(() => client.rest.rpc.mockClear());

  it("calls save_service_with_tags without losing the client binding", async () => {
    const result = await saveServiceTransactional({}, form());

    expect(result).toEqual({ success: "Servicio y tags guardados." });
    expect(client.rest.rpc).toHaveBeenCalledWith(
      "save_service_with_tags",
      expect.objectContaining({ requested_skill_id: SKILL_ID }),
    );
  });
});

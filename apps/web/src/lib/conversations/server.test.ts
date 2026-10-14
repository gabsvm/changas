import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  userId: "45500000-0000-4000-8000-000000000001" as string | null,
  aggregateErrorCode: null as string | null,
  aggregateCount: 0,
  conversationRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mocks.userId ? { id: mocks.userId } : null },
      }),
    },
    rpc: async (name: string) => {
      if (name === "get_my_unread_conversation_count") {
        if (mocks.aggregateErrorCode !== null) {
          const missing = mocks.aggregateErrorCode === "42883";
          return {
            data: null,
            error: {
              code: mocks.aggregateErrorCode,
              message: missing
                ? "could not find the function"
                : "transient upstream failure",
            },
          };
        }
        return { data: mocks.aggregateCount, error: null };
      }
      if (name === "list_my_conversations") {
        return { data: mocks.conversationRows, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  }),
}));

import { getUnreadConversationCount } from "./server";

describe("getUnreadConversationCount (YALO B3)", () => {
  afterEach(() => {
    mocks.userId = "45500000-0000-4000-8000-000000000001";
    mocks.aggregateErrorCode = null;
    mocks.aggregateCount = 0;
    mocks.conversationRows = [];
  });

  function seedFirstPage(unread: number, total = 20): void {
    mocks.conversationRows = Array.from({ length: total }, (_, i) => ({
      conversation_id: `conv-${i}`,
      unread_count: i < unread ? 2 : 0,
    }));
  }

  it("uses the exact aggregate beyond the first page", async () => {
    seedFirstPage(12);
    mocks.aggregateCount = 25;

    await expect(getUnreadConversationCount()).resolves.toBe(25);
  });

  it("falls back to the first-page count when the RPC is missing", async () => {
    seedFirstPage(12);
    mocks.aggregateErrorCode = "42883";

    await expect(getUnreadConversationCount()).resolves.toBe(12);
  });

  it("returns zero on non-ordering errors and without a user", async () => {
    seedFirstPage(12);
    mocks.aggregateErrorCode = "50000";

    await expect(getUnreadConversationCount()).resolves.toBe(0);

    mocks.aggregateErrorCode = null;
    mocks.userId = null;

    await expect(getUnreadConversationCount()).resolves.toBe(0);
  });
});

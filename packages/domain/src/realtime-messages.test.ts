import { describe, expect, it } from "vitest";

import { mergeConversationMessages } from "./realtime-messages";

type Message = {
  message_id: string;
  created_at: string;
  body: string;
};

const first: Message = {
  message_id: "00000000-0000-4000-8000-000000000001",
  created_at: "2026-08-31T20:00:00.000Z",
  body: "Primero",
};

const second: Message = {
  message_id: "00000000-0000-4000-8000-000000000002",
  created_at: "2026-08-31T20:01:00.000Z",
  body: "Segundo",
};

describe("mergeConversationMessages", () => {
  it("deduplicates the same message id", () => {
    expect(mergeConversationMessages([first], [first])).toEqual([first]);
  });

  it("sorts messages chronologically after realtime merge", () => {
    expect(mergeConversationMessages([second], [first])).toEqual([
      first,
      second,
    ]);
  });

  it("uses the newest payload for an existing id", () => {
    const refreshed = { ...first, body: "Actualizado" };
    expect(mergeConversationMessages([first], [refreshed])).toEqual([
      refreshed,
    ]);
  });
});

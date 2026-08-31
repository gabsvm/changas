import { describe, expect, it } from "vitest";

import { buildConversationAttachmentPath } from "./attachments";

describe("buildConversationAttachmentPath", () => {
  it("builds the required conversation/message/random/name path", () => {
    expect(
      buildConversationAttachmentPath(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "../../Mi archivo final.pdf",
        "33333333-3333-4333-8333-333333333333",
      ),
    ).toBe(
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/Mi-archivo-final.pdf",
    );
  });
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const page = readFileSync(
  new URL("../../app/(account)/messages/[conversationId]/page.tsx", import.meta.url),
  "utf8",
);
const thread = readFileSync(
  new URL("../../components/conversations/conversation-thread.tsx", import.meta.url),
  "utf8",
);

describe("mobile conversation layout", () => {
  it("escapes account gutters on mobile so the chat can use the full viewport", () => {
    expect(page).toContain("-mx-5");
    expect(page).toContain("sm:mx-0");
  });

  it("uses an integrated attachment control instead of a visible browser file row", () => {
    expect(thread).toContain('aria-label="Adjuntar"');
    expect(thread).toContain('className="sr-only"');
    expect(thread).not.toContain("file:mr-2");
  });
});

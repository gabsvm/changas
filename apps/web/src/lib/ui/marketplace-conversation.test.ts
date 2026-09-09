import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const conversation = source(
  "../../components/conversations/conversation-thread.tsx",
);
const proposal = source("../../components/conversations/proposal-card.tsx");
const composer = source("../../components/conversations/proposal-composer.tsx");
const filters = source("../../components/discovery/search-filters-sheet.tsx");

describe("marketplace conversation UI contract", () => {
  it("uses compact product surfaces", () => {
    for (const file of [conversation, proposal, composer]) {
      expect(file).not.toContain("font-display");
      expect(file).not.toContain("rounded-[1.75rem]");
      expect(file).not.toContain("shadow-xl");
    }
  });

  it("centralizes filter dialogs in the marketplace BottomSheet", () => {
    expect(filters).toContain("<BottomSheet");
    expect(filters).not.toContain('role="dialog"');
  });
});

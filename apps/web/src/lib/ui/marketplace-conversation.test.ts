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
const messagesList = source("../../app/(account)/messages/page.tsx");

describe("marketplace conversation UI contract", () => {
  it("uses compact product surfaces", () => {
    for (const file of [conversation, proposal, composer]) {
      expect(file).not.toContain("font-display");
      expect(file).not.toContain("rounded-[1.75rem]");
      expect(file).not.toContain("shadow-xl");
    }
  });

  it("keeps the deal visible above the chat with a one-row composer", () => {
    expect(conversation).toContain("#propuestas");
    expect(conversation).toContain("Ver acuerdo");
    expect(conversation).toContain("Adjuntar archivo");
    expect(conversation).toContain("showAttach");
    expect(conversation).toContain("AttachmentComposer");
    expect(conversation).toContain("TextComposer");
  });

  it("surfaces unread state and open deals in the conversation list", () => {
    expect(messagesList).toContain('aria-label="Filtrar conversaciones"');
    expect(messagesList).toContain("filter=unread");
    expect(messagesList).toContain("Acuerdo abierto");
    expect(messagesList).toContain("loadOpenDeals");
    expect(messagesList).toContain("No tenés mensajes sin leer");
  });

  it("centralizes filter dialogs in the marketplace BottomSheet", () => {
    expect(filters).toContain("<BottomSheet");
    expect(filters).not.toContain('role="dialog"');
  });

  it("groups filter fields in labeled sections without changing field names", () => {
    for (const title of ["Qué buscás", "Dónde y cómo", "Precio", "Orden"]) {
      expect(filters).toContain(title);
    }
    expect(filters).toContain("<fieldset");
    expect(filters).toContain("<legend");
    for (const name of [
      'name="category"',
      'name="skill"',
      'name="mode"',
      'name="radius"',
      'name="priceModel"',
      'name="min"',
      'name="max"',
      'name="offers"',
      'name="sort"',
    ]) {
      expect(filters).toContain(name);
    }
  });

  it("gives counter-offers a full-width touch target with banner feedback", () => {
    expect(proposal).toContain("min-h-[52px]");
    expect(proposal).not.toContain("rounded-full px-4 py-2 text-xs");
    expect(proposal).toContain('? "alert" : "status"');
  });

  it("reports composer state in a legible banner", () => {
    expect(composer).toContain('? "alert" : "status"');
    expect(composer).toContain("text-danger");
    expect(composer).not.toContain("text-xs");
  });

  it("keeps dev payment simulation tappable on phones", () => {
    expect(proposal).not.toContain("px-3 py-1.5 text-[11px]");
    expect(proposal).toContain("min-h-11");
  });
});

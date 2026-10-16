import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const load = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const page = load("../../app/(account)/messages/[conversationId]/page.tsx");
const thread = load("../../components/conversations/conversation-thread.tsx");
const composer = load("../../components/conversations/proposal-composer.tsx");
const card = load("../../components/conversations/proposal-card.tsx");

describe("chat hiring and quoting actions", () => {
  it("shows prominent contracting and quoting choices at the top of the chat", () => {
    expect(thread).toContain('aria-label={showHireAction ? "Cotizar y contratar" : "Cotizaciones"}');
    expect(thread.indexOf('aria-label={showHireAction ? "Cotizar y contratar" : "Cotizaciones"}')).toBeLessThan(
      thread.indexOf("{spotlight ? ("),
    );
    expect(thread).toContain('currentUserIsClient ? "Contratar" : "Aceptar oferta"');
    expect(thread).toContain('currentUserIsClient ? "Cotizar" : "Enviar cotización"');
    expect(thread).toContain("disabled={blockedByMe}");
    expect(thread).toContain("overflow-clip");
  });

  it("routes contracting to the accept flow or an appropriately typed proposal", () => {
    expect(page).toContain("actionableProposalId={actionableProposalId}");
    expect(page).toContain("canActorTransitionProposal({");
    expect(thread).toContain("allowDirectBooking ? \"DIRECT_BOOKING\" : \"CLIENT_OFFER\"");
    expect(thread).toContain("getElementById(`propuesta-${actionableProposalId}`)");
    expect(card).toContain('id={`propuesta-${proposal.proposal_id}`}');
  });

  it("opens and selects the existing quote composer without leaving the chat", () => {
    expect(composer).toContain('id="nueva-propuesta"');
    expect(thread).toContain("details.open = true");
    expect(thread).toContain("kindSelect.value = kind");
    expect(thread).toContain('currentUserIsClient ? "QUOTE_REQUEST" : "PROVIDER_QUOTE"');
    expect(thread).toContain('aria-controls="nueva-propuesta"');
  });
});

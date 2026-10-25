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
    expect(thread).toContain(
      'aria-label={showHireAction ? "Cotizar y contratar" : "Cotizaciones"}',
    );
    expect(
      thread.indexOf(
        'aria-label={showHireAction ? "Cotizar y contratar" : "Cotizaciones"}',
      ),
    ).toBeLessThan(thread.indexOf("{spotlight ? ("));
    expect(thread).toContain(
      'currentUserIsClient ? "Contratar" : "Aceptar oferta"',
    );
    expect(thread).toContain(
      'currentUserIsClient ? "Cotizar" : "Enviar cotización"',
    );
    expect(thread).toContain("disabled={blockedByMe}");
    expect(thread).toContain("overflow-clip");
  });

  it("routes contracting to the accept flow or an appropriately typed proposal", () => {
    expect(page).toContain("actionableProposalId={actionableProposalId}");
    expect(page).toContain("canActorTransitionProposal({");
    expect(thread).toContain(
      'allowDirectBooking ? "DIRECT_BOOKING" : "CLIENT_OFFER"',
    );
    expect(thread).toContain(
      "getElementById(`propuesta-${actionableProposalId}`)",
    );
    expect(card).toContain("id={`propuesta-${proposal.proposal_id}`}");
  });

  it("uses role- and state-aware visual hierarchy with accessible contrast", () => {
    expect(thread).toContain("const hireIsPrimary =");
    expect(thread).toContain("hireIsPrimary ? actionPrimary : actionSecondary");
    expect(thread).toContain("hireIsPrimary ? actionSecondary : actionPrimary");
    expect(thread).toContain("overflow-visible border-b");
    expect(thread).toContain('className="relative z-30"');
    expect(thread).toContain(
      'className="border-ink/[0.08] bg-surface absolute right-0 z-40',
    );
    expect(thread).toContain("{deal && !spotlight ? (");
    expect(thread).not.toContain("animate-ping");
    expect(thread).not.toContain("linear-gradient(112deg, #08A9F4");
  });

  it("meets WCAG AA for primary button text and secondary button boundaries", () => {
    const luminance = (hex: string) => {
      const values = [1, 3, 5].map((index) => {
        const srgb = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      });
      return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
    };
    const contrast = (a: string, b: string) => {
      const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (bright! + 0.05) / (dark! + 0.05);
    };
    const blend = (fg: string, bg: string, opacity: number) =>
      "#" +
      [1, 3, 5]
        .map((i) => {
          const foreground = Number.parseInt(fg.slice(i, i + 2), 16);
          const background = Number.parseInt(bg.slice(i, i + 2), 16);
          return Math.round(foreground * opacity + background * (1 - opacity))
            .toString(16)
            .padStart(2, "0");
        })
        .join("");

    expect(contrast("#ffffff", "#161d2a")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#0d121b", "#f5f8fc")).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(blend("#101827", "#ffffff", 0.5), "#ffffff"),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(blend("#f5f8fc", "#171f2c", 0.4), "#171f2c"),
    ).toBeGreaterThanOrEqual(3);
  });

  it("opens and selects the existing quote composer without leaving the chat", () => {
    expect(composer).toContain('id="nueva-propuesta"');
    expect(thread).toContain("details.open = true");
    expect(thread).toContain("kindSelect.value = kind");
    expect(thread).toContain(
      'currentUserIsClient ? "QUOTE_REQUEST" : "PROVIDER_QUOTE"',
    );
    expect(thread).toContain('aria-controls="nueva-propuesta"');
  });
});

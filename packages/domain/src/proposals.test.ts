import { describe, expect, it } from "vitest";

import {
  canActorTransitionProposal,
  canTransitionProposal,
  proposalKinds,
  proposalStatuses,
} from "./proposals";

describe("proposal state machine", () => {
  it("exposes the Phase 05 proposal kinds and statuses", () => {
    expect(proposalKinds).toEqual([
      "DIRECT_BOOKING",
      "QUOTE_REQUEST",
      "PROVIDER_QUOTE",
      "CLIENT_OFFER",
      "COUNTEROFFER",
    ]);
    expect(proposalStatuses).toContain("AWAITING_PAYMENT");
    expect(proposalStatuses).toContain("PAID");
  });

  it("allows only legal lifecycle transitions", () => {
    expect(canTransitionProposal("OPEN", "ACCEPTED")).toBe(true);
    expect(canTransitionProposal("OPEN", "REJECTED")).toBe(true);
    expect(canTransitionProposal("OPEN", "WITHDRAWN")).toBe(true);
    expect(canTransitionProposal("OPEN", "EXPIRED")).toBe(true);
    expect(canTransitionProposal("ACCEPTED", "AWAITING_PAYMENT")).toBe(true);
    expect(canTransitionProposal("AWAITING_PAYMENT", "PAID")).toBe(true);
    expect(canTransitionProposal("AWAITING_PAYMENT", "PAYMENT_FAILED")).toBe(
      true,
    );
    expect(canTransitionProposal("PAID", "OPEN")).toBe(false);
    expect(canTransitionProposal("REJECTED", "ACCEPTED")).toBe(false);
  });

  it("keeps acceptance counterparty-only and withdrawal author-only", () => {
    expect(
      canActorTransitionProposal({
        actorRole: "CLIENT",
        actorIsAuthor: false,
        from: "OPEN",
        to: "ACCEPTED",
      }),
    ).toBe(true);
    expect(
      canActorTransitionProposal({
        actorRole: "PROVIDER",
        actorIsAuthor: false,
        from: "OPEN",
        to: "ACCEPTED",
      }),
    ).toBe(true);
    expect(
      canActorTransitionProposal({
        actorRole: "PROVIDER",
        actorIsAuthor: true,
        from: "OPEN",
        to: "ACCEPTED",
      }),
    ).toBe(false);
    expect(
      canActorTransitionProposal({
        actorRole: "CLIENT",
        actorIsAuthor: false,
        from: "OPEN",
        to: "WITHDRAWN",
      }),
    ).toBe(false);
    expect(
      canActorTransitionProposal({
        actorRole: "PROVIDER",
        actorIsAuthor: true,
        from: "OPEN",
        to: "WITHDRAWN",
      }),
    ).toBe(true);
  });
});

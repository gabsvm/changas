export const proposalKinds = [
  "DIRECT_BOOKING",
  "QUOTE_REQUEST",
  "PROVIDER_QUOTE",
  "CLIENT_OFFER",
  "COUNTEROFFER",
] as const;

export type ProposalKind = (typeof proposalKinds)[number];

export const proposalStatuses = [
  "OPEN",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
  "AWAITING_PAYMENT",
  "PAYMENT_FAILED",
  "PAID",
] as const;

export type ProposalStatus = (typeof proposalStatuses)[number];
export type ProposalActorRole = "CLIENT" | "PROVIDER";

const legalTransitions: Readonly<Record<ProposalStatus, readonly ProposalStatus[]>> = {
  OPEN: ["ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"],
  ACCEPTED: ["AWAITING_PAYMENT"],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
  AWAITING_PAYMENT: ["PAID", "PAYMENT_FAILED"],
  PAYMENT_FAILED: ["AWAITING_PAYMENT"],
  PAID: [],
};

export function canTransitionProposal(
  from: ProposalStatus,
  to: ProposalStatus,
): boolean {
  return legalTransitions[from].includes(to);
}

export function canActorTransitionProposal(input: {
  actorRole: ProposalActorRole;
  actorIsAuthor: boolean;
  from: ProposalStatus;
  to: ProposalStatus;
}): boolean {
  if (!canTransitionProposal(input.from, input.to)) return false;

  if (input.to === "ACCEPTED") return input.actorRole === "CLIENT";
  if (input.to === "WITHDRAWN") return input.actorIsAuthor;
  if (input.to === "REJECTED") return !input.actorIsAuthor;

  if (
    input.to === "AWAITING_PAYMENT" ||
    input.to === "PAID" ||
    input.to === "PAYMENT_FAILED" ||
    input.to === "EXPIRED"
  ) {
    return false;
  }

  return false;
}

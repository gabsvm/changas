import { describe, expect, it } from "vitest";

import {
  mapProposalRpcErrorCode,
  normalizeProposalSummary,
  type ProposalSummary,
} from "./server";

const rawSummary: ProposalSummary = {
  proposal_id: "05500000-0000-4000-8000-000000000001",
  proposal_kind: "PROVIDER_QUOTE",
  proposal_status: "OPEN",
  created_by_user_id: "05500000-0000-4000-8000-000000000002",
  current_version_id: "05510000-0000-4000-8000-000000000001",
  accepted_version_id: null,
  version_number: 1,
  authored_by_user_id: "05500000-0000-4000-8000-000000000002",
  service_title: "Instalación eléctrica",
  modality: "IN_PERSON",
  scope_text: "Instalación de dos tomas y revisión del tablero.",
  price_amount: 1250000,
  currency_code: "ARS",
  schedule_type: "UNSCHEDULED",
  schedule_start_at: null,
  schedule_end_at: null,
  deadline_at: null,
  expected_duration_minutes: 180,
  includes_text: "Mano de obra",
  materials_notes_text: "Materiales aparte",
  expires_at: null,
  created_at: "2026-09-01T12:00:00.000Z",
  updated_at: "2026-09-01T12:00:00.000Z",
};

describe("proposal server contract", () => {
  it("maps database authorization and validation codes to stable app errors", () => {
    expect(mapProposalRpcErrorCode("42501")).toBe("FORBIDDEN");
    expect(mapProposalRpcErrorCode("P0002")).toBe("NOT_FOUND");
    expect(mapProposalRpcErrorCode("22023")).toBe("CONFLICT");
    expect(mapProposalRpcErrorCode("23505")).toBe("CONFLICT");
    expect(mapProposalRpcErrorCode("unexpected")).toBe("TRANSIENT");
  });

  it("rejects malformed proposal rows instead of trusting RPC payloads", () => {
    expect(normalizeProposalSummary(rawSummary)).toEqual(rawSummary);
    expect(() =>
      normalizeProposalSummary({ ...rawSummary, version_number: 0 }),
    ).toThrow("Invalid proposal summary");
    expect(() =>
      normalizeProposalSummary({ ...rawSummary, price_amount: -1 }),
    ).toThrow("Invalid proposal summary");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { simulateFakeProposalPayment } from "./server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const clientUserId = "06600000-0000-4000-8000-000000000001";
const proposalId = "06610000-0000-4000-8000-000000000001";
const acceptedVersionId = "06620000-0000-4000-8000-000000000001";
const paymentNonce = "06630000-0000-4000-8000-000000000001";

const fixedSlotProposal = {
  proposal_id: proposalId,
  proposal_kind: "DIRECT_BOOKING",
  proposal_status: "AWAITING_PAYMENT",
  created_by_user_id: clientUserId,
  current_version_id: acceptedVersionId,
  accepted_version_id: acceptedVersionId,
  version_number: 1,
  authored_by_user_id: clientUserId,
  service_title: "Instalación eléctrica",
  modality: "IN_PERSON",
  scope_text: "Instalación de una luminaria.",
  price_amount: 125000,
  currency_code: "ARS",
  schedule_type: "FIXED_SLOT",
  schedule_start_at: "2026-09-07T15:00:00.000Z",
  schedule_end_at: "2026-09-07T16:00:00.000Z",
  deadline_at: null,
  expected_duration_minutes: 60,
  includes_text: null,
  materials_notes_text: null,
  expires_at: null,
  created_at: "2026-09-01T20:00:00.000Z",
  updated_at: "2026-09-01T20:00:00.000Z",
};

describe("proposal payment slot orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("holds a fixed slot before applying the payment result", async () => {
    const callOrder: string[] = [];
    const rpc = vi.fn(async (name: string) => {
      callOrder.push(name);
      if (name === "list_conversation_proposals") {
        return { data: [fixedSlotProposal], error: null };
      }
      if (name === "hold_proposal_slot") {
        return {
          data: "06640000-0000-4000-8000-000000000001",
          error: null,
        };
      }
      throw new Error(`Unexpected client RPC: ${name}`);
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: clientUserId } },
        })),
      },
      rpc,
    } as never);

    const adminRpc = vi.fn(async (name: string) => {
      callOrder.push(name);
      if (name !== "apply_payment_result") {
        throw new Error(`Unexpected admin RPC: ${name}`);
      }
      return {
        data: [
          {
            payment_attempt_id: "06650000-0000-4000-8000-000000000001",
            resulting_proposal_status: "PAID",
            confirmed_job_id: "06660000-0000-4000-8000-000000000001",
          },
        ],
        error: null,
      };
    });
    vi.mocked(createAdminClient).mockReturnValue({ rpc: adminRpc } as never);

    await simulateFakeProposalPayment(
      "06670000-0000-4000-8000-000000000001",
      proposalId,
      paymentNonce,
      "SUCCESS",
    );

    expect(rpc).toHaveBeenCalledWith("hold_proposal_slot", {
      target_proposal_id: proposalId,
      hold_nonce: paymentNonce,
      ttl_seconds: 600,
    });
    expect(callOrder.indexOf("hold_proposal_slot")).toBeGreaterThan(-1);
    expect(callOrder.indexOf("hold_proposal_slot")).toBeLessThan(
      callOrder.indexOf("apply_payment_result"),
    );
  });
});

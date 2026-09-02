import { describe, expect, it, vi } from "vitest";

import {
  createJobReview,
  createRehireProposal,
  getJobReviewState,
  reportReview,
  upsertProviderReviewReply,
} from "./server";

function rpcClient(data: unknown) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe("Phase 07 job reputation server boundary", () => {
  it("reads participant review state through the dedicated RPC", async () => {
    const client = rpcClient([
      {
        review_id: null,
        can_review: true,
        rating: null,
        quality_rating: null,
        punctuality_rating: null,
        communication_rating: null,
        review_text: null,
        provider_reply: null,
        reported_by_caller: false,
      },
    ]);

    await expect(
      getJobReviewState(
        client as never,
        "11111111-1111-4111-8111-111111111111",
      ),
    ).resolves.toMatchObject({ can_review: true, review_id: null });
    expect(client.rpc).toHaveBeenCalledWith("get_job_review_state", {
      target_job_id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("routes review, reply and report mutations through Phase 07 RPCs", async () => {
    const client = rpcClient("22222222-2222-4222-8222-222222222222");

    await createJobReview(client as never, {
      jobId: "11111111-1111-4111-8111-111111111111",
      rating: 5,
      reviewText: "Excelente trabajo",
      qualityRating: 5,
      punctualityRating: 4,
      communicationRating: 5,
    });
    await upsertProviderReviewReply(
      client as never,
      "22222222-2222-4222-8222-222222222222",
      "Gracias por la reseña",
    );
    await reportReview(
      client as never,
      "22222222-2222-4222-8222-222222222222",
      "OTHER",
      "Necesita revisión",
    );

    expect(client.rpc).toHaveBeenNthCalledWith(1, "create_job_review", {
      target_job_id: "11111111-1111-4111-8111-111111111111",
      requested_rating: 5,
      requested_review_text: "Excelente trabajo",
      requested_quality_rating: 5,
      requested_punctuality_rating: 4,
      requested_communication_rating: 5,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(
      2,
      "upsert_provider_review_reply",
      {
        target_review_id: "22222222-2222-4222-8222-222222222222",
        requested_reply_text: "Gracias por la reseña",
      },
    );
    expect(client.rpc).toHaveBeenNthCalledWith(3, "report_review", {
      target_review_id: "22222222-2222-4222-8222-222222222222",
      requested_reason: "OTHER",
      requested_details: "Necesita revisión",
    });
  });

  it("returns the new proposal/conversation created by rehire", async () => {
    const client = rpcClient([
      {
        conversation_id: "33333333-3333-4333-8333-333333333333",
        proposal_id: "44444444-4444-4444-8444-444444444444",
        proposal_kind: "DIRECT_BOOKING",
        proposal_status: "AWAITING_PAYMENT",
      },
    ]);

    await expect(
      createRehireProposal(
        client as never,
        "11111111-1111-4111-8111-111111111111",
      ),
    ).resolves.toMatchObject({
      conversation_id: "33333333-3333-4333-8333-333333333333",
      proposal_id: "44444444-4444-4444-8444-444444444444",
    });
    expect(client.rpc).toHaveBeenCalledWith("create_rehire_proposal", {
      target_job_id: "11111111-1111-4111-8111-111111111111",
    });
  });
});

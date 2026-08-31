import { beforeEach, describe, expect, it, vi } from "vitest";

const sendConversationText = vi.fn();
const recordConversationModerationWarning = vi.fn();

vi.mock("@/lib/conversations/messages", () => ({
  sendConversationText,
}));

vi.mock("@/lib/conversations/server", () => ({
  ConversationServerError: class ConversationServerError extends Error {},
  recordConversationModerationWarning,
}));

import { sendTextMessage } from "./actions";

const conversationId = "04840000-0000-4000-8000-000000000001";
const nonce = "04860000-0000-4000-8000-000000000001";

function form(body: string, confirmed = false): FormData {
  const data = new FormData();
  data.set("conversationId", conversationId);
  data.set("nonce", nonce);
  data.set("body", body);
  if (confirmed) data.set("confirmLeakage", "true");
  return data;
}

describe("sendTextMessage contact leakage warning", () => {
  beforeEach(() => {
    sendConversationText.mockReset();
    recordConversationModerationWarning.mockReset();
    sendConversationText.mockResolvedValue("04850000-0000-4000-8000-000000000001");
    recordConversationModerationWarning.mockResolvedValue(undefined);
  });

  it("warns and does not send when contact data is detected", async () => {
    const result = await sendTextMessage(
      { status: "IDLE", message: "" },
      form("Mi mail es persona@example.com"),
    );

    expect(result.status).toBe("WARNING");
    expect(result.signalTypes).toEqual(["EMAIL"]);
    expect(sendConversationText).not.toHaveBeenCalled();
    expect(recordConversationModerationWarning).toHaveBeenCalledWith(
      conversationId,
      ["EMAIL"],
    );
  });

  it("sends detected contact data only after explicit confirmation", async () => {
    const result = await sendTextMessage(
      { status: "IDLE", message: "" },
      form("Mi mail es persona@example.com", true),
    );

    expect(result.status).toBe("SUCCESS");
    expect(recordConversationModerationWarning).toHaveBeenCalledWith(
      conversationId,
      ["EMAIL"],
    );
    expect(sendConversationText).toHaveBeenCalledWith(
      conversationId,
      "Mi mail es persona@example.com",
      nonce,
    );
  });

  it("sends ordinary messages without warning audit", async () => {
    const result = await sendTextMessage(
      { status: "IDLE", message: "" },
      form("Puedo ir mañana a las 15"),
    );

    expect(result.status).toBe("SUCCESS");
    expect(recordConversationModerationWarning).not.toHaveBeenCalled();
    expect(sendConversationText).toHaveBeenCalledOnce();
  });
});

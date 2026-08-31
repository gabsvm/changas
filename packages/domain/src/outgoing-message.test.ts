import { describe, expect, it } from "vitest";

import { assessOutgoingMessage } from "./outgoing-message";

describe("assessOutgoingMessage", () => {
  it("sends ordinary messages without confirmation", () => {
    expect(assessOutgoingMessage("Puedo ir mañana a las 15", false)).toEqual({
      action: "SEND",
      signalTypes: [],
    });
  });

  it("warns before sending detected contact or payment data", () => {
    expect(
      assessOutgoingMessage("Mi mail es persona@example.com", false),
    ).toEqual({
      action: "WARN",
      signalTypes: ["EMAIL"],
    });
  });

  it("allows the same message after explicit confirmation", () => {
    expect(
      assessOutgoingMessage("Mi mail es persona@example.com", true),
    ).toEqual({
      action: "SEND",
      signalTypes: ["EMAIL"],
    });
  });

  it("returns only unique signal types, never matched text", () => {
    const assessment = assessOutgoingMessage(
      "persona@example.com y otro@example.com; hablemos por WhatsApp",
      false,
    );

    expect(assessment).toEqual({
      action: "WARN",
      signalTypes: ["EMAIL", "EXTERNAL_CONTACT_REQUEST"],
    });
    expect(JSON.stringify(assessment)).not.toContain("persona@example.com");
  });
});

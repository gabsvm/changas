import { describe, expect, it } from "vitest";

import { messageTextSchema } from "./index";

describe("messageTextSchema", () => {
  it("trims valid conversation text", () => {
    expect(messageTextSchema.parse("  Hola  ")).toBe("Hola");
  });

  it("rejects empty conversation text", () => {
    expect(() => messageTextSchema.parse("   ")).toThrow();
  });

  it("rejects conversation text above 4000 characters", () => {
    expect(() => messageTextSchema.parse("x".repeat(4001))).toThrow();
  });
});

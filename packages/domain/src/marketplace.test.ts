import { describe, expect, it } from "vitest";

import {
  canPublishProviderOffering,
  priceModels,
  serviceModalities,
  scheduleTypes,
} from "./marketplace";

describe("marketplace domain", () => {
  it("keeps the complete price and modality catalogs explicit", () => {
    expect(priceModels).toEqual([
      "FIXED",
      "STARTING_AT",
      "HOURLY",
      "PER_UNIT",
      "QUOTE",
    ]);
    expect(serviceModalities).toEqual(["IN_PERSON", "REMOTE", "BOTH"]);
    expect(scheduleTypes).toEqual([
      "FIXED_SLOT",
      "FLEXIBLE_WINDOW",
      "DEADLINE",
      "UNSCHEDULED",
    ]);
  });

  it("requires an active, unpaused provider for public offerings", () => {
    expect(
      canPublishProviderOffering({
        status: "ACTIVE",
        providerPaused: false,
      }),
    ).toBe(true);
    expect(
      canPublishProviderOffering({
        status: "ACTIVE",
        providerPaused: true,
      }),
    ).toBe(false);
    expect(
      canPublishProviderOffering({
        status: "IDENTITY_PENDING",
        providerPaused: false,
      }),
    ).toBe(false);
  });
});

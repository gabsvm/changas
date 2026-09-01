import { describe, expect, it } from "vitest";

import {
  canActorTransitionJob,
  isStructurallyValidJobSchedule,
  isTerminalJobStatus,
} from "./jobs";

describe("job lifecycle", () => {
  it("keeps execution and completion actor-specific", () => {
    expect(canActorTransitionJob("CONFIRMED", "IN_PROGRESS", "PROVIDER")).toBe(
      true,
    );
    expect(canActorTransitionJob("CONFIRMED", "IN_PROGRESS", "CLIENT")).toBe(
      false,
    );
    expect(
      canActorTransitionJob("IN_PROGRESS", "COMPLETION_REQUESTED", "PROVIDER"),
    ).toBe(true);
    expect(
      canActorTransitionJob("COMPLETION_REQUESTED", "COMPLETED", "CLIENT"),
    ).toBe(true);
    expect(
      canActorTransitionJob("COMPLETION_REQUESTED", "COMPLETED", "PROVIDER"),
    ).toBe(false);
  });

  it("treats contractual terminal states as terminal", () => {
    expect(isTerminalJobStatus("COMPLETED")).toBe(true);
    expect(isTerminalJobStatus("CANCELLED")).toBe(true);
    expect(isTerminalJobStatus("CONFIRMED")).toBe(false);
    expect(isTerminalJobStatus("DISPUTED")).toBe(false);
  });

  it("validates schedule structure by schedule type", () => {
    expect(
      isStructurallyValidJobSchedule({
        scheduleType: "FIXED_SLOT",
        startsAt: "2026-09-02T14:00:00Z",
        endsAt: "2026-09-02T15:00:00Z",
      }),
    ).toBe(true);
    expect(
      isStructurallyValidJobSchedule({
        scheduleType: "FIXED_SLOT",
        startsAt: "2026-09-02T15:00:00Z",
        endsAt: "2026-09-02T14:00:00Z",
      }),
    ).toBe(false);
    expect(
      isStructurallyValidJobSchedule({
        scheduleType: "DEADLINE",
        deadlineAt: "2026-09-03T18:00:00Z",
      }),
    ).toBe(true);
    expect(
      isStructurallyValidJobSchedule({ scheduleType: "UNSCHEDULED" }),
    ).toBe(true);
  });
});

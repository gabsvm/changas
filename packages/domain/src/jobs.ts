import type { ScheduleType } from "./marketplace";

export const jobStatuses = [
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETION_REQUESTED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "EXPIRED",
  "NO_SHOW",
] as const;

export type JobStatus = (typeof jobStatuses)[number];
export type JobActorRole = "CLIENT" | "PROVIDER" | "SYSTEM";

const terminalStatuses = new Set<JobStatus>([
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "EXPIRED",
  "NO_SHOW",
]);

export function isTerminalJobStatus(status: JobStatus): boolean {
  return terminalStatuses.has(status);
}

export function canActorTransitionJob(
  from: JobStatus,
  to: JobStatus,
  actor: JobActorRole,
): boolean {
  if (from === "CONFIRMED" && to === "IN_PROGRESS") {
    return actor === "PROVIDER";
  }
  if (from === "IN_PROGRESS" && to === "COMPLETION_REQUESTED") {
    return actor === "PROVIDER";
  }
  if (from === "COMPLETION_REQUESTED" && to === "COMPLETED") {
    return actor === "CLIENT";
  }
  if (
    ["CONFIRMED", "IN_PROGRESS", "COMPLETION_REQUESTED"].includes(from) &&
    ["CANCELLED", "DISPUTED"].includes(to)
  ) {
    return actor === "CLIENT" || actor === "PROVIDER";
  }
  if (from === "CONFIRMED" && to === "NO_SHOW") {
    return actor === "CLIENT" || actor === "PROVIDER";
  }
  if (
    ["COMPLETED", "DISPUTED"].includes(from) &&
    ["REFUNDED", "PARTIALLY_REFUNDED"].includes(to)
  ) {
    return actor === "SYSTEM";
  }
  if (from === "CONFIRMED" && to === "EXPIRED") {
    return actor === "SYSTEM";
  }
  return false;
}

export type JobScheduleDraft = {
  scheduleType: ScheduleType;
  startsAt?: string | null;
  endsAt?: string | null;
  deadlineAt?: string | null;
};

export function isStructurallyValidJobSchedule(
  schedule: JobScheduleDraft,
): boolean {
  const starts = schedule.startsAt ? Date.parse(schedule.startsAt) : NaN;
  const ends = schedule.endsAt ? Date.parse(schedule.endsAt) : NaN;

  switch (schedule.scheduleType) {
    case "UNSCHEDULED":
      return !schedule.startsAt && !schedule.endsAt && !schedule.deadlineAt;
    case "DEADLINE":
      return Boolean(schedule.deadlineAt) && !schedule.startsAt && !schedule.endsAt;
    case "FIXED_SLOT":
    case "FLEXIBLE_WINDOW":
      return (
        Boolean(schedule.startsAt) &&
        Boolean(schedule.endsAt) &&
        !schedule.deadlineAt &&
        Number.isFinite(starts) &&
        Number.isFinite(ends) &&
        ends > starts
      );
  }
}

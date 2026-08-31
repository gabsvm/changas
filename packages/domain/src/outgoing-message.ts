import {
  detectContactLeakage,
  type LeakageSignalType,
} from "./contact-leakage";

export type OutgoingMessageAssessment = {
  action: "SEND" | "WARN";
  signalTypes: LeakageSignalType[];
};

export function assessOutgoingMessage(
  text: string,
  explicitlyConfirmed: boolean,
): OutgoingMessageAssessment {
  const signalTypes = Array.from(
    new Set(detectContactLeakage(text).map((signal) => signal.type)),
  );

  return {
    action:
      signalTypes.length > 0 && !explicitlyConfirmed ? "WARN" : "SEND",
    signalTypes,
  };
}

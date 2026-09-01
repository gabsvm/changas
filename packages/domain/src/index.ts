export type JsonPrimitive = boolean | number | string | null;

export type JsonObject = { [key: string]: JsonValue };

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export {
  canSelfManageProviderStatus,
  providerStatuses,
  type ProviderStatus,
} from "./provider-status";
export {
  canPublishProviderOffering,
  priceModels,
  scheduleTypes,
  serviceModalities,
  type PriceModel,
  type ScheduleType,
  type ServiceModality,
} from "./marketplace";
export {
  formatMinorUnits,
  formatServicePrice,
  minorUnitsToMajorInput,
  parseMajorAmountToMinor,
  parseServicePrice,
  supportedCurrencyCodes,
  type CurrencyCode,
} from "./money";
export {
  normalizeDiscoveryQuery,
  parseDiscoveryFilters,
  parseDiscoveryFiltersFromInternal,
  rankDiscoveryResult,
  type DiscoveryFilters,
  type DiscoveryRankingSignals,
  type DiscoverySort,
} from "./discovery";
export {
  getManualLocation,
  manualLocations,
  type ManualLocation,
} from "./location";
export {
  adjustedRating,
  distanceBucketLabels,
  type DistanceBucket,
} from "./discovery-public";
export {
  conversationParticipantRoles,
  conversationStatuses,
  messageKinds,
  type ConversationCursor,
  type ConversationParticipantRole,
  type ConversationStatus,
  type MessageCursor,
  type MessageKind,
} from "./conversations";
export {
  detectContactLeakage,
  type LeakageSignal,
  type LeakageSignalType,
} from "./contact-leakage";
export {
  assessOutgoingMessage,
  type OutgoingMessageAssessment,
} from "./outgoing-message";
export {
  mergeConversationMessages,
  type MergeableConversationMessage,
} from "./realtime-messages";
export {
  canActorTransitionProposal,
  canTransitionProposal,
  proposalKinds,
  proposalStatuses,
  type ProposalActorRole,
  type ProposalKind,
  type ProposalStatus,
} from "./proposals";
export {
  FakePaymentProvider,
  paymentStatuses,
  type FakePaymentOutcome,
  type PaymentProvider,
  type PaymentRecord,
  type PaymentRequest,
  type PaymentStatus,
} from "./payments";

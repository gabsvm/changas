export const conversationStatuses = ["OPEN", "BLOCKED", "CLOSED"] as const;
export type ConversationStatus = (typeof conversationStatuses)[number];

export const messageKinds = ["TEXT", "IMAGE", "FILE", "SYSTEM"] as const;
export type MessageKind = (typeof messageKinds)[number];

export const conversationParticipantRoles = ["CLIENT", "PROVIDER"] as const;
export type ConversationParticipantRole =
  (typeof conversationParticipantRoles)[number];

export type ConversationCursor = {
  updatedAt: string;
  id: string;
};

export type MessageCursor = {
  createdAt: string;
  id: string;
};

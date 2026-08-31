export type MergeableConversationMessage = {
  message_id: string;
  created_at: string;
};

export function mergeConversationMessages<
  T extends MergeableConversationMessage,
>(current: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map<string, T>();

  for (const message of current) byId.set(message.message_id, message);
  for (const message of incoming) byId.set(message.message_id, message);

  return [...byId.values()].sort((left, right) => {
    const byCreatedAt = left.created_at.localeCompare(right.created_at);
    if (byCreatedAt !== 0) return byCreatedAt;
    return left.message_id.localeCompare(right.message_id);
  });
}

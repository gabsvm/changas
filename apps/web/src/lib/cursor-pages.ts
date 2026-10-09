import { isUuid } from "@changas/validation";

export type PageKey = {
  at: string;
  id: string;
};

export function parsePageCursor(input: {
  before?: string | string[] | undefined;
  beforeId?: string | string[] | undefined;
}): PageKey | null {
  const before = Array.isArray(input.before)
    ? (input.before[0] ?? "")
    : (input.before ?? "");
  const beforeId = Array.isArray(input.beforeId)
    ? (input.beforeId[0] ?? "")
    : (input.beforeId ?? "");
  if (!before || !Number.isFinite(Date.parse(before))) return null;
  if (!isUuid(beforeId)) return null;
  return { at: before, id: beforeId };
}

export type PagedResult<T> = {
  items: T[];
  next: PageKey | null;
};

/**
 * Accumulates keyset pages from the start through a visible cursor, so
 * server-rendered "show more" links keep every loaded row on screen.
 * `through` is the key of the last visible item (null for the first page).
 * The fetcher receives a +1 limit to detect a following page without an
 * extra round trip. Items are de-duplicated by id so mid-paging inserts
 * cannot repeat rows.
 */
export async function accumulateThrough<T>(
  fetchPage: (cursor: PageKey | null, limit: number) => Promise<T[]>,
  keyOf: (item: T) => PageKey,
  idOf: (item: T) => string,
  through: PageKey | null,
  pageSize: number,
  maxPages = 8,
): Promise<PagedResult<T>> {
  const items: T[] = [];
  const seen = new Set<string>();
  const pushNew = (batch: T[]): void => {
    for (const item of batch) {
      const id = idOf(item);
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(item);
    }
  };

  let cursor: PageKey | null = null;
  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchPage(cursor, pageSize + 1);
    if (batch.length <= pageSize) {
      pushNew(batch);
      return { items, next: null };
    }
    pushNew(batch.slice(0, pageSize));
    const pageKey = keyOf(batch[pageSize - 1] as T);
    if (through === null) return { items, next: pageKey };
    if (pageKey.at === through.at && pageKey.id === through.id) {
      const extra = await fetchPage(pageKey, pageSize + 1);
      if (extra.length <= pageSize) {
        pushNew(extra);
        return { items, next: null };
      }
      pushNew(extra.slice(0, pageSize));
      return { items, next: keyOf(extra[pageSize - 1] as T) };
    }
    cursor = pageKey;
  }
  const tail = items[items.length - 1];
  return { items, next: tail === undefined ? null : keyOf(tail) };
}

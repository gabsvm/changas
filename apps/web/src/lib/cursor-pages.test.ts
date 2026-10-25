import { describe, expect, it, vi } from "vitest";

import {
  accumulateThrough,
  parsePageCursor,
  type PageKey,
} from "./cursor-pages";

type Row = { at: string; id: string };

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    at: `2026-01-${String(30 - Math.floor(index / 10)).padStart(2, "0")}T00:00:00.000Z`,
    id: `id-${String(index).padStart(3, "0")}`,
  }));
}

function keysetFetcher(source: Row[]) {
  return vi.fn(async (cursor: PageKey | null, limit: number) => {
    const start =
      cursor === null
        ? 0
        : source.findIndex(
            (row) => row.at === cursor.at && row.id === cursor.id,
          ) + 1;
    return source.slice(start, start + limit);
  });
}

const keyOf = (row: Row): PageKey => ({ at: row.at, id: row.id });
const idOf = (row: Row): string => row.id;

describe("accumulateThrough", () => {
  it("returns the first page with a next cursor in one fetch", async () => {
    const fetchPage = keysetFetcher(rows(65));

    const result = await accumulateThrough(fetchPage, keyOf, idOf, null, 20);

    expect(result.items).toHaveLength(20);
    expect(result.items[0]?.id).toBe("id-000");
    expect(result.next).toEqual({ at: result.items[19]?.at, id: "id-019" });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(null, 21);
  });

  it("accumulates through the visible cursor plus one page", async () => {
    const fetchPage = keysetFetcher(rows(65));
    const through = { at: "2026-01-29T00:00:00.000Z", id: "id-019" };

    const result = await accumulateThrough(fetchPage, keyOf, idOf, through, 20);

    expect(result.items).toHaveLength(40);
    expect(result.items[39]?.id).toBe("id-039");
    expect(result.next?.id).toBe("id-039");
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("ends the list with a null cursor on the final page", async () => {
    const fetchPage = keysetFetcher(rows(65));
    const through = { at: "2026-01-25T00:00:00.000Z", id: "id-059" };

    const result = await accumulateThrough(fetchPage, keyOf, idOf, through, 20);

    expect(result.items).toHaveLength(65);
    expect(result.items[64]?.id).toBe("id-064");
    expect(result.next).toBeNull();
  });

  it("returns everything when the source fits one page", async () => {
    const fetchPage = keysetFetcher(rows(7));

    const result = await accumulateThrough(fetchPage, keyOf, idOf, null, 20);

    expect(result.items).toHaveLength(7);
    expect(result.next).toBeNull();
  });

  it("falls forward from an older cursor outside the reconstruction bound", async () => {
    const source = rows(120);
    const fetchPage = keysetFetcher(source);
    const through = keyOf(source[59] as Row);

    const result = await accumulateThrough(
      fetchPage,
      keyOf,
      idOf,
      through,
      20,
      2,
    );

    expect(result.items.map(idOf)).toEqual(source.slice(60, 80).map(idOf));
    expect(result.next?.id).toBe("id-079");
    expect(result.windowed).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("advances through 12+ pages with bounded reads and no gaps across windows", async () => {
    const source = rows(300);
    const fetchPage = keysetFetcher(source);
    const seen = new Set<string>();
    let through: PageKey | null = null;
    let startFromCursor = false;
    let previousIndex = -1;

    for (let advance = 0; advance < 13; advance++) {
      const callsBefore = fetchPage.mock.calls.length;
      const result: { items: Row[]; next: PageKey | null; windowed?: boolean } = await accumulateThrough(
        fetchPage,
        keyOf,
        idOf,
        through,
        20,
        8,
        startFromCursor,
      );
      for (const row of result.items) seen.add(row.id);
      if (through) {
        const index = Number(through.id.slice(3));
        expect(index).toBeGreaterThan(previousIndex);
        previousIndex = index;
        if (result.windowed) {
          expect(result.items[0]?.id).toBe(`id-${String(index + 1).padStart(3, "0")}`);
        }
      }
      through = result.next;
      startFromCursor = result.windowed ?? false;
      expect(fetchPage.mock.calls.length - callsBefore).toBeLessThanOrEqual(9);
    }

    expect([...seen].sort()).toEqual(source.slice(0, 260).map(idOf));
    expect(through?.id).toBe("id-259");
  });

  it("parses cursor params and rejects malformed ones", () => {
    expect(
      parsePageCursor({
        before: "2026-01-29T00:00:00.000Z",
        beforeId: "06620000-0000-4000-8000-000000000001",
      }),
    ).toEqual({
      at: "2026-01-29T00:00:00.000Z",
      id: "06620000-0000-4000-8000-000000000001",
    });
    expect(parsePageCursor({})).toBeNull();
    expect(
      parsePageCursor({ before: "not-a-date", beforeId: "id-019" }),
    ).toBeNull();
    expect(
      parsePageCursor({
        before: "2026-01-29T00:00:00.000Z",
        beforeId: "not-a-uuid",
      }),
    ).toBeNull();
  });

  it("de-duplicates rows that shift between pages", async () => {
    const source = rows(45);
    const fetchPage = vi.fn(async (cursor: PageKey | null, limit: number) => {
      const base = await keysetFetcher(source)(cursor, limit);
      // Simulate an insert shifting the second page back by one row.
      if (cursor !== null) return [source[19] as Row, ...base].slice(0, limit);
      return base;
    });
    const through = { at: "2026-01-29T00:00:00.000Z", id: "id-019" };

    const result = await accumulateThrough(fetchPage, keyOf, idOf, through, 20);

    const ids = result.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The duplicate consumes one slot of the second page.
    expect(result.items).toHaveLength(39);
  });
});

export const SITEMAP_URL_LIMIT = 50_000;

export async function collectPaginated<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1_000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function splitSitemapUrls<T>(urls: T[]): T[][] {
  const chunks: T[][] = [];
  for (let from = 0; from < urls.length; from += SITEMAP_URL_LIMIT) {
    chunks.push(urls.slice(from, from + SITEMAP_URL_LIMIT));
  }
  return chunks.length ? chunks : [[]];
}

export type SitemapUrl = {
  loc: string;
  lastModified?: string | null;
  changeFrequency?: "daily" | "weekly" | "monthly";
  priority?: number;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderSitemapIndex(urls: string[]): string {
  const entries = urls
    .map((url) => `<sitemap><loc>${escapeXml(url)}</loc></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}

export function renderSitemapUrlSet(urls: SitemapUrl[]): string {
  const entries = urls
    .map((url) => {
      const lastModified = url.lastModified
        ? `<lastmod>${escapeXml(url.lastModified)}</lastmod>`
        : "";
      const changeFrequency = url.changeFrequency
        ? `<changefreq>${url.changeFrequency}</changefreq>`
        : "";
      const priority =
        url.priority === undefined ? "" : `<priority>${url.priority}</priority>`;
      return `<url><loc>${escapeXml(url.loc)}</loc>${lastModified}${changeFrequency}${priority}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

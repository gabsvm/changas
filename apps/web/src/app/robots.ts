import type { MetadataRoute } from "next";

import { getPublicSiteUrl } from "@changas/config/public";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account/", "/provider/", "/api/", "/auth/"],
    },
    sitemap: baseUrl + "/sitemap.xml",
  };
}

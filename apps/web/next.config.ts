import type { NextConfig } from "next";

// Content-Security-Policy starts in report-only mode: Next.js hydration needs
// inline scripts and styles, so enforcing it requires nonces first. Violations
// show up in the browser console without blocking anything.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    // Camera is used to capture identity documents; geolocation for nearby search.
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

const immutableCacheControl = {
  key: "Cache-Control",
  value: "public, max-age=31536000, immutable",
};

// Assets estáticos de /public que no cambian entre despliegues.
const immutableAssetSources = [
  "/categories/:path*",
  "/brand/:path*",
  "/fonts/:path*",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/icon-192.svg",
  "/icon-512.svg",
  "/apple-touch-icon.png",
  "/apple-icon.png",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  transpilePackages: [
    "@changas/config",
    "@changas/domain",
    "@changas/validation",
  ],
  // Next's default same-origin check covers the app host; allow only the
  // explicitly configured origin when a reverse proxy requires it.
  experimental: {
    serverActions: {
      allowedOrigins: process.env.SITE_ALLOWED_ORIGIN
        ? [process.env.SITE_ALLOWED_ORIGIN]
        : [],
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...immutableAssetSources.map((source) => ({
        source,
        headers: [immutableCacheControl],
      })),
    ];
  },
};

export default nextConfig;

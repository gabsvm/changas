import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@changas/config",
    "@changas/domain",
    "@changas/validation",
  ],
};

export default nextConfig;

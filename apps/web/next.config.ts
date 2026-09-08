import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@ot/core", "@ot/db"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  serverExternalPackages: ["mysql2"],
};

export default config;

import type { NextConfig } from "next";

// Set by the Electron build to produce a static export in ./out.
const isElectron = process.env.ELECTRON_BUILD === "1";

const nextConfig: NextConfig = {
  /* config options here */
  ...(isElectron
    ? { output: "export" as const, images: { unoptimized: true }, trailingSlash: false }
    : {}),
  experimental: {
    agentFeedback: true,
  },
  ...(isElectron ? {} : { cacheComponents: true, partialPrefetching: true }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

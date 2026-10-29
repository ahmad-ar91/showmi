import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The demo audit reads its sample screenshots from disk; ship them with that function.
  outputFileTracingIncludes: {
    "/api/analyze-aso": ["./public/samples/**/*"],
  },
  partialPrefetching: true,
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // bodySizeLimit affects Server Actions only (not API routes).
  // Admin upload uses a streaming API route; nginx still needs client_max_body_size.
  experimental: {
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

/** Python AI sidecar (FastAPI). Proxied so the browser only talks to the Next site. */
const aiAgentsOrigin = (process.env.AI_AGENTS_ORIGIN || "http://127.0.0.1:8001").replace(
  /\/$/,
  ""
);

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/openmrs/:path*',
        destination: `${backendUrl}/openmrs/:path*`,
      },
      {
        source: '/bahmni/:path*',
        destination: `${backendUrl}/bahmni/:path*`,
      },
      {
        source: '/crater-api/:path*',
        destination: `${backendUrl}/crater-api/:path*`,
      },
      {
        source: "/ai-service/:path*",
        destination: `${aiAgentsOrigin}/:path*`,
      },
    ]
  },
};

export default nextConfig;

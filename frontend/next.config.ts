import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://127.0.0.1';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/openmrs/:path*',
        destination: `http://127.0.0.1:8080/openmrs/:path*`,
      },
      {
        source: '/bahmni/:path*',
        destination: `${backendUrl}/bahmni/:path*`,
      },
      {
        source: '/crater-api/:path*',
        destination: `${backendUrl}/crater-api/:path*`,
      },
    ]
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/openmrs/:path*',
        destination: 'http://localhost:8080/openmrs/:path*',
      },
      {
        source: '/bahmni/:path*',
        destination: 'http://localhost:80/bahmni/:path*',
      },
      {
        source: '/crater-api/:path*',
        destination: 'https://localhost:444/api/v1/:path*',
      },
    ]
  },
};

export default nextConfig;

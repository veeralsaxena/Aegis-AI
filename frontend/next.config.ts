import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://dirgelike-superartificially-rachelle.ngrok-free.dev';

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
    ]
  },
};

export default nextConfig;

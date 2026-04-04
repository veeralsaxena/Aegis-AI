import type { NextConfig } from "next";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://localhost';
console.log('Proxying to backend:', backendUrl);

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

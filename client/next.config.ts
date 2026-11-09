import type { NextConfig } from 'next';

const backend = process.env.BACKEND_API_URL || 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/health', destination: `${backend}/health` },
    ];
  },
};

export default nextConfig;

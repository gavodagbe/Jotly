import type { NextConfig } from "next";

function normalizeBackendBaseUrl(value: string): string {
  return value.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

const backendApiBaseUrl = normalizeBackendBaseUrl(
  process.env.BACKEND_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3001"
);

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendApiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

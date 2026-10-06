import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "0.0.0.0",
    "*.cursor.com",
    "*.cursor.sh",
  ],
  async rewrites() {
    return [{ source: "/w/:key.js", destination: "/w/:key" }];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.bizlyro.com" }],
        destination: "https://bizlyro.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

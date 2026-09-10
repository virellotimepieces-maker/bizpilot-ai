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
};

export default nextConfig;

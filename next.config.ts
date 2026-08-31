import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: { optimizePackageImports: ["lucide-react", "recharts"] },
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;

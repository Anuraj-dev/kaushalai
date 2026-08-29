import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { optimizePackageImports: ["lucide-react", "recharts"] },
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;

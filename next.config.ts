import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: { optimizePackageImports: ["lucide-react", "recharts"] },
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingIncludes: { "/*": ["./src/db/migrations/**/*.sql", "./sih.json"] },
};

export default nextConfig;

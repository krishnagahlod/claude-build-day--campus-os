import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a production build run alongside `next dev` without clobbering .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false, // keep the dev badge out of the demo
};

export default nextConfig;

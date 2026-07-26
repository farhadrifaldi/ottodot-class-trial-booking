import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin explicitly: an unrelated lockfile in a parent directory (outside this
  // repo) otherwise makes Turbopack guess the wrong workspace root.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // The test harness (tests/global-setup.ts) builds+starts its own server in
  // an isolated dist dir, so it never collides with a `next dev` someone has
  // open on this same project directory (Next.js only allows one `next dev`
  // per project dir, and shares the default `.next/` between dev and build).
  ...(process.env.NEXT_TEST_DIST_DIR
    ? { distDir: process.env.NEXT_TEST_DIST_DIR }
    : {}),
};

export default nextConfig;

import type { NextConfig } from "next";
import { buildChallengesManifest } from "./scripts/build-challenges.mjs";

// Bundle the GitOps challenge JSON into a manifest before the build/dev server
// reads it — Cloudflare Workers have no filesystem, so problems ship in the
// bundle (see src/lib/challenges.ts). Runs for `next dev`, `next build`, and
// `opennextjs-cloudflare build` (which invokes next build).
buildChallengesManifest();

const nextConfig: NextConfig = {
  // Pin the workspace root so Next.js doesn't infer it from a stray
  // lockfile elsewhere on the machine (e.g. the user home directory).
  turbopack: {
    root: import.meta.dirname,
  },
  // Keep the native libSQL client out of the bundler; load it at runtime.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;

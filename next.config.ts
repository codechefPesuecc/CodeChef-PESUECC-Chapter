import type { NextConfig } from "next";
import { buildChallengesManifest } from "./scripts/build-challenges.mjs";
import { buildTeamManifest } from "./scripts/build-team.mjs";

// Bundle filesystem-backed content into manifests before the build/dev server
// reads it — Cloudflare Workers have no filesystem, so the GitOps challenge JSON
// (see src/lib/challenges.ts) and the team roster (see src/app/team/lib.ts) ship
// in the bundle. Runs for `next dev`, `next build`, and `opennextjs-cloudflare
// build` (which invokes next build).
buildChallengesManifest();
buildTeamManifest();

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy. `'unsafe-inline'` is required for Next's inline
// bootstrap scripts and CodeMirror/next-font's injected styles (no nonce plumbing
// yet); `'unsafe-eval'` is dev-only (HMR), and `upgrade-insecure-requests` is
// prod-only so it doesn't break http://localhost. challenges.cloudflare.com is
// allowed for Turnstile (active only when its keys are set).
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Pin the workspace root so Next.js doesn't infer it from a stray
  // lockfile elsewhere on the machine (e.g. the user home directory).
  turbopack: {
    root: import.meta.dirname,
  },
  // Keep the native libSQL client out of the bundler; load it at runtime.
  serverExternalPackages: ["@libsql/client", "libsql"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

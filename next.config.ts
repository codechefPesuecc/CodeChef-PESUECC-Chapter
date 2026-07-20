import type { NextConfig } from "next";

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

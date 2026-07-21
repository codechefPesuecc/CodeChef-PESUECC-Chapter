/**
 * Next.js runs `register()` once when a server instance starts. We use it to
 * apply DB migrations automatically (dev and in the Docker image), so the SQLite
 * file is always schema-current without a manual step. Node runtime only —
 * guarded so it never runs in the Edge runtime or during static prerender.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrations } = await import("./server/db/migrate");
  await runMigrations();
}

/**
 * Thin client for the self-hosted Piston sandbox (the code-execution engine
 * from the README). In the local stack it runs as the `piston` container and is
 * reached over the compose network at `PISTON_URL`.
 */
import os from "node:os";

const PISTON_URL = process.env.PISTON_URL ?? "http://localhost:2000";

/**
 * Global concurrency cap for sandbox EXECUTION jobs. Piston's time limit is
 * wall-clock, so when many submissions run at once and the box's CPU saturates,
 * correct solutions can blow the limit and false-TLE. Bounding total in-flight
 * jobs (≈ one per core) keeps timings fair under load; excess jobs queue FIFO.
 * Override with JUDGE_CONCURRENCY. Cheap runtime-metadata queries are not capped.
 */
const MAX_CONCURRENT_JOBS = Math.max(
  1,
  Number(process.env.JUDGE_CONCURRENCY) || (os.cpus?.().length ?? 4) - 1,
);
let activeJobs = 0;
const jobQueue: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  if (activeJobs < MAX_CONCURRENT_JOBS) {
    activeJobs++;
    return Promise.resolve();
  }
  return new Promise((resolve) => jobQueue.push(resolve));
}

function releaseSlot(): void {
  const next = jobQueue.shift();
  if (next) next();
  else activeJobs--;
}

export function pistonQueueStats() {
  return { active: activeJobs, queued: jobQueue.length, max: MAX_CONCURRENT_JOBS };
}

/** Maps our language ids to Piston's language names. */
export const PISTON_LANGUAGE: Record<string, string> = {
  cpp: "c++",
  c: "c",
  python: "python",
  java: "java",
  csharp: "csharp",
  javascript: "javascript",
  go: "go",
  rust: "rust",
  zig: "zig",
};

export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

export async function pistonRuntimes(): Promise<PistonRuntime[]> {
  const res = await fetch(`${PISTON_URL}/api/v2/runtimes`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`piston runtimes ${res.status}`);
  return (await res.json()) as PistonRuntime[];
}

export interface PistonExecuteResult {
  run: {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    wall_time?: number;
    cpu_time?: number;
  };
  compile?: { stdout: string; stderr: string; code: number | null };
}

export async function pistonExecute(params: {
  language: string;
  version: string;
  files: { name: string; content: string }[];
  stdin?: string;
  runTimeoutMs?: number;
}): Promise<PistonExecuteResult> {
  // Bounded concurrency: wait for a slot before hitting the sandbox.
  await acquireSlot();
  try {
    const res = await fetch(`${PISTON_URL}/api/v2/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        language: params.language,
        version: params.version,
        files: params.files,
        stdin: params.stdin ?? "",
        run_timeout: params.runTimeoutMs ?? 3000,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`piston execute ${res.status}: ${detail}`);
    }
    return (await res.json()) as PistonExecuteResult;
  } finally {
    releaseSlot();
  }
}

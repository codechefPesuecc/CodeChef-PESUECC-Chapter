/**
 * Thin client for the self-hosted Piston sandbox (the code-execution engine
 * from the README). In the local stack it runs as the `piston` container and is
 * reached over the compose network at `PISTON_URL`.
 *
 * The submit route (next milestone) will use `pistonExecute` to compile and run
 * a submission against hidden tests. For now `pistonRuntimes` backs /api/health.
 */
const PISTON_URL = process.env.PISTON_URL ?? "http://localhost:2000";

/** Maps our language ids to Piston's language names. */
export const PISTON_LANGUAGE: Record<string, string> = {
  cpp: "c++",
  python: "python",
  java: "java",
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
  run: { stdout: string; stderr: string; code: number | null; signal: string | null };
  compile?: { stdout: string; stderr: string; code: number | null };
}

export async function pistonExecute(params: {
  language: string;
  version: string;
  files: { name: string; content: string }[];
  stdin?: string;
  runTimeoutMs?: number;
}): Promise<PistonExecuteResult> {
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
  if (!res.ok) throw new Error(`piston execute ${res.status}`);
  return (await res.json()) as PistonExecuteResult;
}

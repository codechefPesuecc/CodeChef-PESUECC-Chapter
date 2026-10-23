import { describe, expect, it } from "vitest";
import { MAX_JUDGE_BATCH_BYTES, batchTests } from "./judge";

describe("batchTests", () => {
  it("keeps each judge request under Akiro's body limit, in order", () => {
    const tests = Array.from({ length: 12 }, (_, i) => ({ input: `${i}`.padEnd(400_000, "x"), output: `${i}` }));
    const batches = batchTests(tests);
    expect(batches.flat()).toEqual(tests);
    for (const batch of batches) {
      const bytes = batch.reduce((n, t) => n + JSON.stringify({ input: t.input, expected_output: t.output }).length, 0);
      expect(bytes).toBeLessThanOrEqual(MAX_JUDGE_BATCH_BYTES);
    }
    expect(batches.length).toBeGreaterThan(3);
  });

  it("sends small questions in one request", () => {
    expect(batchTests([{ input: "1\n", output: "1\n" }, { input: "2\n", output: "2\n" }])).toHaveLength(1);
  });
});

describe("withJobMarker", () => {
  it("appends a comment in the language's own syntax, so identical programs stay distinct for Akiro", async () => {
    const { withJobMarker } = await import("@/lib/judge");
    expect(withJobMarker("cpp", "int main(){}", "job-1")).toBe("int main(){}\n// job-1\n");
    expect(withJobMarker("python", "print(1)", "job-2")).toBe("print(1)\n# job-2\n");
    expect(withJobMarker("pypy", "print(1)", "job-3")).toBe("print(1)\n# job-3\n");
    expect(withJobMarker("java", "class Main{}", "a")).not.toBe(withJobMarker("java", "class Main{}", "b"));
  });
});

describe("judge requests", () => {
  function akiroReply(body: unknown, delayMs = 0): Promise<Response> {
    return new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(body), { status: 200 })), delayMs));
  }

  it("never parks a request behind another: a burst of judge calls all run at once", async () => {
    const { judgeExecute, judgeQueueStats } = await import("@/lib/judge");
    let inFlight = 0;
    let peak = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      const res = await akiroReply({ job_id: "j", verdict: "Accepted", total_cpu_time_ms: 1, peak_memory_kb: 1, test_results: [] }, 20);
      inFlight -= 1;
      return res;
    }) as typeof fetch;
    try {
      const results = await Promise.all(Array.from({ length: 12 }, () => judgeExecute({ language: "cpp", code: "int main(){}", stdin: "" })));
      expect(results.every((r) => r.verdict === "Accepted")).toBe(true);
      expect(peak).toBe(12);
      expect(judgeQueueStats()).toEqual({ active: 0, queued: 0 });
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("shows the compiler's message for a compile error when Akiro returns it as compile_output", async () => {
    const { judgeTests } = await import("./judge");
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      akiroReply({ job_id: "j", verdict: "CompilationError", total_cpu_time_ms: 0, peak_memory_kb: 0, compile_output: "main.cpp:2:5: error: expected ';'", test_results: [] })) as typeof fetch;
    try {
      const res = await judgeTests({ tests: [{ input: "1\n", output: "1\n" }], checker: { type: "token" }, language: "cpp", code: "int main(){ oops }", timeLimitMs: 1000, memLimitBytes: 64 << 20 });
      expect(res.verdict).toBe("CE");
      expect(res.detail).toContain("expected ';'");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

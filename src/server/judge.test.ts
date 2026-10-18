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

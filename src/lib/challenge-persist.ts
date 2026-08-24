import { renderMarkdown } from "@/lib/markdown";
import type { ChallengeInput } from "@/lib/challenge-schema";
import type { NewChallengeRow } from "@/server/db/schema";

/**
 * Turns a validated authoring input into a DB row, rendering the Markdown prose to
 * sanitized HTML (content_html) at write time — the same shape the seed produces, so
 * the request path serves stored HTML and never loads the Markdown pipeline (see
 * #124). The admin API validates with AdminChallengeSchema, so `slug` is present;
 * `createdAt` is passed through unchanged on edit to preserve the publish timestamp.
 */
export async function toChallengeRow(
  input: ChallengeInput & { slug: string },
  timestamps: { createdAt: number; updatedAt: number },
): Promise<NewChallengeRow> {
  const contentHtml = JSON.stringify({
    statement: await renderMarkdown(input.statement),
    inputFormat: await renderMarkdown(input.inputFormat ?? ""),
    outputFormat: await renderMarkdown(input.outputFormat ?? ""),
    constraints: await renderMarkdown(input.constraints ?? ""),
    sampleExplanations: await Promise.all(
      input.samples.map((s) => renderMarkdown(s.explanation ?? "")),
    ),
  });
  return {
    slug: input.slug,
    title: input.title,
    difficulty: input.difficulty ?? "Unrated",
    tags: JSON.stringify(input.tags ?? []),
    date: input.date ?? null,
    timeLimit: input.timeLimit ?? null,
    memoryLimit: input.memoryLimit ?? null,
    author: input.author ?? null,
    statement: input.statement,
    inputFormat: input.inputFormat ?? null,
    outputFormat: input.outputFormat ?? null,
    constraints: input.constraints ?? null,
    samples: JSON.stringify(input.samples),
    contentHtml,
    tests: JSON.stringify(input.tests),
    checker: JSON.stringify(input.checker ?? { type: "token" }),
    schemaVersion: input.schemaVersion ?? 1,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  };
}

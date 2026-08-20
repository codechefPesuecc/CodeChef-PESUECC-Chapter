import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getTeacherUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { monstrContests, monstrProblems } from "@/server/db/schema";
import { generateJoinCode } from "@/lib/monstr-join-code";
import { renderMarkdown } from "@/lib/markdown";
import { PISTON_LANGUAGE } from "@/lib/piston";
import { bodyTooLarge } from "@/server/limits";
import type { Checker } from "@/lib/challenges";

export const dynamic = "force-dynamic";

interface MonstrProblemInput {
  title: string;
  statement: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  timeLimit?: string;
  memoryLimit?: string;
  samples: Array<{ input: string; output: string }>;
  tests: Array<{ input: string; output: string }>;
  checker?: Checker;
}

/**
 * Create a new Monstr contest with inline problems.
 */
export async function POST(req: Request) {
  const teacher = await getTeacherUser();
  if (!teacher) {
    return NextResponse.json(
      { ok: false, error: "Teacher access required." },
      { status: 403 },
    );
  }

  const oversize = bodyTooLarge(req);
  if (oversize) return oversize;

  let body: {
    title?: string;
    durationMinutes?: number;
    allowedLanguages?: string[];
    problems?: MonstrProblemInput[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { title, durationMinutes, allowedLanguages, problems } = body;

  // Validate contest fields
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "Contest title is required." },
      { status: 400 },
    );
  }

  if (typeof durationMinutes !== "number" || durationMinutes < 5 || durationMinutes > 480) {
    return NextResponse.json(
      { ok: false, error: "Duration must be between 5 and 480 minutes." },
      { status: 400 },
    );
  }

  if (!Array.isArray(allowedLanguages) || allowedLanguages.length === 0) {
    return NextResponse.json(
      { ok: false, error: "At least one language must be selected." },
      { status: 400 },
    );
  }

  // Validate all languages are supported
  for (const lang of allowedLanguages) {
    if (!PISTON_LANGUAGE[lang]) {
      return NextResponse.json(
        { ok: false, error: `Unsupported language: ${lang}.` },
        { status: 400 },
      );
    }
  }

  if (!Array.isArray(problems) || problems.length === 0) {
    return NextResponse.json(
      { ok: false, error: "At least one problem is required." },
      { status: 400 },
    );
  }

  // Validate problems
  for (let i = 0; i < problems.length; i++) {
    const p = problems[i];
    if (!p.title || typeof p.title !== "string") {
      return NextResponse.json(
        { ok: false, error: `Problem ${i + 1}: title is required.` },
        { status: 400 },
      );
    }
    if (!p.statement || typeof p.statement !== "string") {
      return NextResponse.json(
        { ok: false, error: `Problem ${i + 1}: statement is required.` },
        { status: 400 },
      );
    }
    if (!Array.isArray(p.samples) || p.samples.length === 0) {
      return NextResponse.json(
        { ok: false, error: `Problem ${i + 1}: at least one sample is required.` },
        { status: 400 },
      );
    }
    if (!Array.isArray(p.tests) || p.tests.length === 0) {
      return NextResponse.json(
        { ok: false, error: `Problem ${i + 1}: at least one hidden test is required.` },
        { status: 400 },
      );
    }
  }

  try {
    const db = getDb();
    const contestId = crypto.randomUUID();
    const now = Date.now();

    // Generate join code (retry once on collision)
    let joinCode = generateJoinCode();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Insert contest
        await db.insert(monstrContests).values({
          id: contestId,
          teacherId: teacher.id,
          title,
          joinCode,
          durationMinutes,
          allowedLanguages: JSON.stringify(allowedLanguages),
          startedAt: null,
          endsAt: null,
          createdAt: now,
        });
        break;
      } catch (error) {
        if (
          String(error).includes("UNIQUE constraint failed") &&
          attempt === 0
        ) {
          joinCode = generateJoinCode();
          continue;
        }
        throw error;
      }
    }

    // Insert problems
    for (let i = 0; i < problems.length; i++) {
      const p = problems[i];
      const problemId = crypto.randomUUID();

      // Render Markdown to HTML for storage
      const [statementHtml, inputFormatHtml, outputFormatHtml, constraintsHtml] =
        await Promise.all([
          renderMarkdown(p.statement),
          p.inputFormat ? renderMarkdown(p.inputFormat) : Promise.resolve(""),
          p.outputFormat ? renderMarkdown(p.outputFormat) : Promise.resolve(""),
          p.constraints ? renderMarkdown(p.constraints) : Promise.resolve(""),
        ]);

      const contentHtml = JSON.stringify({
        statement: statementHtml,
        inputFormat: inputFormatHtml,
        outputFormat: outputFormatHtml,
        constraints: constraintsHtml,
        sampleExplanations: [],
      });

      const checker = p.checker ?? { type: "token" as const };

      await db.insert(monstrProblems).values({
        id: problemId,
        contestId,
        orderIndex: i,
        title: p.title,
        statement: p.statement,
        inputFormat: p.inputFormat,
        outputFormat: p.outputFormat,
        constraints: p.constraints,
        timeLimit: p.timeLimit,
        memoryLimit: p.memoryLimit,
        samples: JSON.stringify(p.samples),
        contentHtml,
        tests: JSON.stringify(p.tests),
        checker: JSON.stringify(checker),
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ ok: true, contestId, joinCode });
  } catch (error) {
    console.error("[api/monstr/contests] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create contest." },
      { status: 500 },
    );
  }
}

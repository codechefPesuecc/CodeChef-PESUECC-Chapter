import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getChallengeBySlug,
  getDailyChallenge,
  toPublicContent,
} from "@/lib/challenges";
import ProblemStatement from "@/components/cp-arena/ProblemStatement";
import ArenaWorkspace from "@/components/cp-arena/ArenaWorkspace";

// The released set and today's daily are date-dependent — resolve per request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallengeBySlug(slug);
  return {
    title: challenge ? `${challenge.title} · Practice` : "Practice",
  };
}

export default async function ArchiveProblemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const challenge = await getChallengeBySlug(slug);

  // Unreleased or unknown slugs don't resolve — no early leak of a future set.
  if (!challenge) notFound();

  // Today's live problem is always solved ranked at /cp-arena/solve/[slug], never as practice.
  const daily = await getDailyChallenge();
  if (daily?.slug === slug) redirect(`/cp-arena/solve/${slug}`);

  const sample = challenge.samples[0];

  // Full-viewport IDE (fixed inset-0) — the title, difficulty, tags and limits all
  // render inside the Description panel, so no separate page header is needed.
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `footer { display: none !important; }` }} />
      <ArenaWorkspace
        slug={challenge.slug}
        problem={<ProblemStatement challenge={toPublicContent(challenge)} />}
        sampleInput={sample?.input ?? ""}
        sampleOutput={sample?.output ?? ""}
        practice
      />
    </>
  );
}

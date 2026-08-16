import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import manifest from "../initiatives.manifest.json";
import { ArrowLeft, Calendar, Trophy, Users } from "lucide-react";
import EventTimeline from "./EventTimeline";
import TeamShowcase from "./TeamShowcase";
import WinnersShowcase from "./WinnersShowcase";

export function generateStaticParams() {
  return manifest.events.map((e: { id: string }) => ({ slug: e.id }));
}

export default async function InitiativeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const event = manifest.events.find((e: { id: string }) => e.id === resolvedParams.slug);
  
  if (!event) {
    notFound();
  }

  return (
    <main className="min-h-screen pb-32 pt-32">
      {/* Hero Section */}
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <Link 
          href="/initiatives" 
          className="mb-8 inline-flex items-center text-sm font-medium text-chocolate/70 hover:text-chocolate dark:text-cream/70 dark:hover:text-cream transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Initiatives
        </Link>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-4 mb-6">
              <span className="inline-flex items-center rounded-full bg-chocolate/10 px-3 py-1 text-sm font-medium text-chocolate dark:bg-cream/10 dark:text-cream">
                {event.category}
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {event.status}
              </span>
            </div>
            
            <h1 className="font-space text-5xl md:text-7xl font-bold tracking-tight text-chocolate dark:text-cream mb-6">
              {event.title}
            </h1>
            
            <p className="text-lg md:text-xl text-chocolate/80 dark:text-cream/80 leading-relaxed mb-8">
              {event.description}
            </p>
            
            <div className="flex items-center gap-2 text-sm font-medium text-chocolate/60 dark:text-cream/60">
              <Calendar className="h-4 w-4" />
              <span>Cadence: {event.cadence}</span>
            </div>
          </div>
          
          <div className="relative aspect-video lg:aspect-square overflow-hidden rounded-2xl border border-[#e2e8f0] dark:border-[#3a2c20] shadow-xl">
            {event.image && (
              <Image 
                src={event.image} 
                alt={event.title}
                fill
                className="object-cover"
                priority
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        </div>
      </div>

      {/* Detailed Description */}
      <div className="mx-auto max-w-3xl px-6 lg:px-8 mt-24 text-center">
        <div className="prose prose-lg dark:prose-invert mx-auto text-chocolate/80 dark:text-cream/80 font-medium leading-relaxed">
          {event.detailedExplanation}
        </div>
      </div>

      {/* Vertical Tree Timeline */}
      {event.timeline && event.timeline.length > 0 && (
        <div className="mt-32">
          <div className="text-center mb-16">
            <h2 className="font-space text-4xl font-bold text-chocolate dark:text-cream">Event Timeline</h2>
            <p className="mt-4 text-chocolate/70 dark:text-cream/70">The journey and history of {event.title}.</p>
          </div>
          <EventTimeline timeline={event.timeline} />
        </div>
      )}

      {/* Hall of Fame (Winners) */}
      {event.winners && event.winners.length > 0 && (
        <div className="mt-32 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-12">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <h2 className="font-space text-4xl font-bold text-chocolate dark:text-cream">Hall of Fame</h2>
          </div>
          <WinnersShowcase winners={event.winners} />
        </div>
      )}

      {/* Judges & Mentors */}
      {event.mentors && event.mentors.length > 0 && (
        <div className="mt-32 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-12">
            <Users className="h-8 w-8 text-blue-500" />
            <h2 className="font-space text-4xl font-bold text-chocolate dark:text-cream">Judges & Mentors</h2>
          </div>
          <TeamShowcase team={event.mentors} />
        </div>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Post types & data for the Newsroom                                 */
/* ------------------------------------------------------------------ */

export type PostType = "announcement" | "recap" | "spotlight" | "tech-news";

/**
 * Unified Newsroom post. Covers every content category the Newsroom
 * publishes: announcements, event recaps, member spotlights, and
 * curated tech-news items.
 */
export interface NewsPost {
  slug: string;
  title: string;
  tagline: string;
  date: string;
  /** ISO date for sorting (YYYY-MM-DD). */
  sortDate: string;
  type: PostType;
  /** Only relevant for recap posts tied to events. */
  status?: "completed" | "upcoming";
  image: string;
  summary: string;
  /** Pinned posts appear in the featured hero slot at the top. */
  pinned?: boolean;
  /** Author name for spotlights and tech news. */
  author?: string;
  /** External source URL for tech-news items. */
  source?: string;
  /** e.g. "3 min read" */
  readTime?: string;
  /** Original event type label for legacy compat (e.g. "Hackathon"). */
  eventType?: string;
  highlights?: { label: string; value: string }[];
  /* --- Full event fields (only for recap type) --- */
  location?: string;
  description?: string[];
  schedule?: { time: string; activity: string }[];
}

/* ------------------------------------------------------------------ */
/*  Legacy interface — kept for backward compatibility with the        */
/*  [slug] detail page until it is migrated to NewsPost.               */
/* ------------------------------------------------------------------ */

export interface EventData {
  slug: string;
  title: string;
  tagline: string;
  date: string;
  location: string;
  type: string;
  status: "completed" | "upcoming";
  image: string;
  summary: string;
  description: string[];
  highlights: { label: string; value: string }[];
  schedule?: { time: string; activity: string }[];
}

/* ------------------------------------------------------------------ */
/*  All posts                                                          */
/* ------------------------------------------------------------------ */

export const posts: NewsPost[] = [
  /* ---- Pinned announcement ---- */
  {
    slug: "arena-season-2-launch",
    title: "Arena Season 2 Is Live",
    tagline: "New problems. New rewards. New leaderboard.",
    date: "August 2025",
    sortDate: "2025-08-10",
    type: "announcement",
    pinned: true,
    image: "/events/leetcode101.jpg",
    summary:
      "Season 2 of the CP Arena kicks off with a fresh problem pool, revamped scoring, and ₹2,000 in monthly bounties. The daily Problem of the Day resets at IST midnight — your streak starts now.",
    author: "Core Team",
    readTime: "2 min read",
    highlights: [
      { label: "Monthly Bounty", value: "₹2,000" },
      { label: "New Problems", value: "60+" },
    ],
  },

  /* ---- Event recaps (migrated from original events array) ---- */
  {
    slug: "praxis-2024",
    title: "Praxis 2024",
    tagline: "Build. Ship. Win.",
    date: "October 2024",
    sortDate: "2024-10-15",
    type: "recap",
    eventType: "Hackathon",
    status: "completed",
    image: "/events/praxis-2024.jpg",
    summary:
      "Praxis 2024 was the chapter's flagship 24-hour hackathon that brought together developers, designers, and innovators from across Bangalore to build real products under pressure.",
    readTime: "5 min read",
    highlights: [
      { label: "Participants", value: "200+" },
      { label: "Teams", value: "55" },
      { label: "Prize Pool", value: "₹50,000" },
      { label: "Duration", value: "24 Hours" },
    ],
    location: "PES University, ECC Campus",
    description: [
      "Praxis 2024 was a high-intensity 24-hour hackathon organized by the CodeChef PESUECC Chapter. Over 200 participants formed teams of 2–4 and tackled real-world problem statements spanning fintech, ed-tech, healthtech, and sustainability.",
      "The event featured mentorship from industry professionals, midnight energy boosters, and a rigorous judging process led by senior engineers from top startups. Teams were evaluated on innovation, technical execution, design, and real-world viability.",
      "Praxis wasn't just about code — it was a full-stack experience. From ideation workshops before the clock started, to a demo day where the top 10 teams pitched on stage, the event pushed every participant to think beyond the terminal.",
    ],
    schedule: [
      { time: "09:00 AM", activity: "Registration & Check-in" },
      { time: "10:00 AM", activity: "Opening Ceremony & Problem Reveal" },
      { time: "11:00 AM", activity: "Hacking Begins" },
      { time: "06:00 PM", activity: "Mentor Round 1" },
      { time: "12:00 AM", activity: "Midnight Fuel & Check-in" },
      { time: "08:00 AM", activity: "Final Submissions" },
      { time: "10:00 AM", activity: "Top 10 Demo Day & Judging" },
      { time: "12:00 PM", activity: "Awards Ceremony" },
    ],
  },
  {
    slug: "algohunt",
    title: "AlgoHunt",
    tagline: "Decode. Discover. Dominate.",
    date: "August 2024",
    sortDate: "2024-08-20",
    type: "recap",
    eventType: "Treasure Hunt × Hackathon",
    status: "completed",
    image: "/events/algohunt.jpg",
    summary:
      "AlgoHunt merged competitive programming with a physical treasure hunt — teams solved algorithmic clues scattered across campus to unlock the next challenge.",
    readTime: "4 min read",
    highlights: [
      { label: "Teams", value: "40+" },
      { label: "Stages", value: "7" },
      { label: "Campuses", value: "5" },
      { label: "Duration", value: "5 Hours" },
    ],
    location: "PES University, ECC Campus",
    description: [
      "AlgoHunt was a one-of-a-kind hybrid event that combined the thrill of a campus-wide treasure hunt with the mental intensity of competitive programming. Teams of 3 raced through a series of algorithmic challenges, each solved problem revealing a physical clue hidden somewhere on campus.",
      "The event was designed to test both coding skills and teamwork. Clues required participants to decode ciphers, solve graph problems on paper, and even reverse-engineer binary sequences to find GPS coordinates. The first team to crack all stages and reach the final checkpoint won.",
      "AlgoHunt attracted participation from multiple colleges across Bangalore, making it one of the chapter's most talked-about inter-college events. The format was novel enough that teams had to strategize — split up to hunt, or stay together to code?",
    ],
    schedule: [
      { time: "02:00 PM", activity: "Team Registration & Briefing" },
      { time: "02:30 PM", activity: "Stage 1 — Online Coding Round" },
      { time: "03:15 PM", activity: "Stage 2 — Campus Clue Hunt Begins" },
      { time: "04:00 PM", activity: "Stage 3–5 — Progressive Challenges" },
      { time: "05:30 PM", activity: "Stage 6 — Final Puzzle Room" },
      { time: "06:30 PM", activity: "Stage 7 — Checkpoint & Grand Finale" },
      { time: "07:00 PM", activity: "Results & Prize Distribution" },
    ],
  },
  {
    slug: "leetcode101",
    title: "LeetCode 101",
    tagline: "From Zero to Interview-Ready.",
    date: "September 2024",
    sortDate: "2024-09-05",
    type: "recap",
    eventType: "Workshop Series",
    status: "completed",
    image: "/events/leetcode101.jpg",
    summary:
      "LeetCode 101 was a structured workshop series designed to take students from DSA fundamentals to confidently solving medium-level interview problems.",
    readTime: "4 min read",
    highlights: [
      { label: "Sessions", value: "9" },
      { label: "Attendees", value: "120+" },
      { label: "Topics", value: "12" },
      { label: "Duration", value: "3 Weeks" },
    ],
    location: "PES University, ECC Campus",
    description: [
      "LeetCode 101 was a 3-week structured workshop series run by the CodeChef PESUECC Chapter, aimed at students preparing for technical interviews and competitive programming contests. The series covered arrays, strings, hashmaps, two pointers, sliding windows, recursion, trees, graphs, and dynamic programming.",
      "Each session was led by experienced problem setters and seniors who broke down patterns rather than just solutions. Participants didn't just solve problems — they learned to recognize categories, choose the right approach, and optimize under time pressure.",
      "The series included live problem-solving sessions, take-home problem sets graded on an internal leaderboard, and a final mock contest that simulated a real interview coding round. Over 120 students completed the full series.",
    ],
    schedule: [
      { time: "Week 1", activity: "Arrays, Strings & Hash Maps" },
      { time: "Week 1", activity: "Two Pointers & Sliding Window" },
      { time: "Week 1", activity: "Recursion & Backtracking" },
      { time: "Week 2", activity: "Linked Lists & Stacks/Queues" },
      { time: "Week 2", activity: "Trees & Binary Search Trees" },
      { time: "Week 2", activity: "Graphs — BFS & DFS" },
      { time: "Week 3", activity: "Dynamic Programming Fundamentals" },
      { time: "Week 3", activity: "Advanced DP & Greedy" },
      { time: "Week 3", activity: "Mock Interview Contest" },
    ],
  },

  /* ---- Announcement ---- */
  {
    slug: "registrations-open-praxis-2025",
    title: "Praxis 2025 — Registrations Open",
    tagline: "The flagship hackathon returns this November.",
    date: "September 2025",
    sortDate: "2025-09-01",
    type: "announcement",
    status: "upcoming",
    image: "/events/praxis-2024.jpg",
    summary:
      "Praxis 2025 is a 24-hour hackathon open to all colleges across Bangalore. Teams of 2–4 will tackle problem statements in AI, sustainability, and developer tooling. Early-bird registration closes September 20.",
    author: "Core Team",
    readTime: "2 min read",
    highlights: [
      { label: "Date", value: "Nov 8–9" },
      { label: "Spots", value: "80 Teams" },
    ],
  },

  /* ---- Member Spotlight ---- */
  {
    slug: "spotlight-akshat-navlani",
    title: "From Fearing DP to Setting Problems",
    tagline: "Member Spotlight · Akshat Navlani",
    date: "July 2025",
    sortDate: "2025-07-15",
    type: "spotlight",
    image: "/events/leetcode101.jpg",
    summary:
      "Akshat joined the chapter in his second year, scared of dynamic programming. Two semesters later, he's setting rated problems on the Arena and mentoring juniors through the same topics that once stumped him.",
    author: "Akshat Navlani",
    readTime: "3 min read",
    highlights: [
      { label: "Problems Set", value: "14" },
      { label: "Arena Rank", value: "#3" },
    ],
  },

  /* ---- Tech News ---- */
  {
    slug: "tech-pulse-rust-linux-kernel",
    title: "Rust Lands in the Linux Kernel — Why It Matters",
    tagline: "Tech Pulse · Systems Programming",
    date: "August 2025",
    sortDate: "2025-08-05",
    type: "tech-news",
    image: "/events/algohunt.jpg",
    summary:
      "The Linux kernel now ships production Rust modules. For students learning systems programming, this is the clearest signal yet that memory-safe languages aren't just academic — they're infrastructure.",
    author: "SMM Team",
    readTime: "3 min read",
    source: "https://lkml.org",
  },
  {
    slug: "tech-pulse-codeforces-edu-rounds",
    title: "Codeforces Launches Educational Rounds for Universities",
    tagline: "Tech Pulse · Competitive Programming",
    date: "July 2025",
    sortDate: "2025-07-28",
    type: "tech-news",
    image: "/events/praxis-2024.jpg",
    summary:
      "Codeforces now offers university-branded educational rounds with structured problem sets mapped to DSA curricula. We're exploring hosting one for PES — stay tuned.",
    author: "SMM Team",
    readTime: "2 min read",
    source: "https://codeforces.com",
  },
  {
    slug: "tech-pulse-github-copilot-free-students",
    title: "GitHub Copilot Is Now Free for All Students",
    tagline: "Tech Pulse · Developer Tools",
    date: "June 2025",
    sortDate: "2025-06-20",
    type: "tech-news",
    image: "/events/leetcode101.jpg",
    summary:
      "GitHub expanded Copilot access to every verified student account worldwide. Here's how to activate it with your PES email, and why you should pair it with deliberate practice, not replace it.",
    author: "SMM Team",
    readTime: "2 min read",
    source: "https://github.com/education",
  },
];

/* ------------------------------------------------------------------ */
/*  Upcoming Posts (Timeline)                                          */
/* ------------------------------------------------------------------ */

export const upcomingPosts = [
  { step: "01", title: "AlgoHunt 2025", body: "The flagship treasure hunt returns. Code, decode, discover.", date: "October 2025" },
  { step: "02", title: "Tech Pulse 02", body: "A breakdown of the new React compiler and what it means for our projects.", date: "September 2025" },
  { step: "03", title: "LeetCode 102", body: "Advanced graphs, dynamic programming, and systems design.", date: "September 2025" },
  { step: "04", title: "Member Spotlight", body: "An inside look at how our ops team manages 500+ participants.", date: "November 2025" },
];

/* ------------------------------------------------------------------ */
/*  Sorted posts (newest first)                                        */
/* ------------------------------------------------------------------ */

export const sortedPosts: NewsPost[] = [...posts].sort(
  (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime(),
);

/* ------------------------------------------------------------------ */
/*  Legacy helpers — kept so the [slug] detail page still works.       */
/* ------------------------------------------------------------------ */

export const events: EventData[] = posts
  .filter((p): p is NewsPost & { status: "completed" | "upcoming" } =>
    p.type === "recap" && p.status != null,
  )
  .map((p) => ({
    slug: p.slug,
    title: p.title,
    tagline: p.tagline,
    date: p.date,
    location: p.location ?? "PES University, ECC Campus",
    type: p.eventType ?? "Event",
    status: p.status,
    image: p.image,
    summary: p.summary,
    description: p.description ?? [],
    highlights: p.highlights ?? [],
    schedule: p.schedule,
  }));

export function getEventBySlug(slug: string): EventData | undefined {
  return events.find((e) => e.slug === slug);
}

export function getPostBySlug(slug: string): NewsPost | undefined {
  return posts.find((p) => p.slug === slug);
}

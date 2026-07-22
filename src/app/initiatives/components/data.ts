export const stats = [
  { label: "Flagship Events", value: "3+", progress: 92 },
  { label: "Production Platforms", value: "2", progress: 79 },
  { label: "Students Reached", value: "500+", progress: 66 },
  { label: "Culture", value: "Daily CP", progress: 53 },
];

export const events = [
  {
    id: "leetcode-101",
    title: "LeetCode 101",
    category: "Learning Pipeline",
    status: "Cohort Program",
    cadence: "Weekly foundations",
    description:
      "A guided problem-solving pipeline for students moving from syntax comfort to interview-ready competitive thinking.",
    highlights: ["Pattern-first sessions", "Mentor-led reviews", "Editorial practice"],
    accent: "01",
    image: "/dev-team.jpg",
    gallery: [
      { src: "/dev-team.jpg", caption: "Mentor-led pattern sessions" },
      { src: "/dev-team.jpg", caption: "Weekly practice cohorts" },
      { src: "/dev-team.jpg", caption: "Editorial review circles" },
    ],
    href: "/newsroom?initiative=leetcode-101",
  },
  {
    id: "algohunt",
    title: "AlgoHunt",
    category: "Gamified Algorithmic Event",
    status: "Flagship Contest",
    cadence: "Campus-scale hunt",
    description:
      "A physical-digital contest where algorithms unlock checkpoints, clues, and leaderboard momentum across campus.",
    highlights: ["Puzzle-backed routes", "Live scoring", "Team-based solving"],
    accent: "02",
    image: "/dev-team.jpg",
    gallery: [
      { src: "/dev-team.jpg", caption: "Campus checkpoints and clue drops" },
      { src: "/dev-team.jpg", caption: "Team solving under live pressure" },
      { src: "/dev-team.jpg", caption: "Leaderboard-driven finale" },
    ],
    href: "/newsroom?initiative=algohunt",
  },
  {
    id: "praxis",
    title: "Praxis Hackathon",
    category: "Rapid AI / Build Sprint",
    status: "Hackathon Engine",
    cadence: "Sprint format",
    description:
      "A high-pressure build sprint for shipping AI-assisted products, prototypes, and technical demos under real constraints.",
    highlights: ["Fast ideation", "Demo-first judging", "Production mindset"],
    accent: "03",
    image: "/dev-team.jpg",
    gallery: [
      { src: "/dev-team.jpg", caption: "Rapid AI product ideation" },
      { src: "/dev-team.jpg", caption: "Build sprint execution" },
      { src: "/dev-team.jpg", caption: "Final demos and judging" },
    ],
    href: "/newsroom?initiative=praxis",
  },
];

export const systems = [
  {
    id: "eclipse",
    title: "Eclipse",
    role: "Event Infrastructure",
    description:
      "The operations layer for registrations, team flows, announcements, check-ins, and event control during large chapter launches.",
    metrics: [
      { label: "Modules", value: "Ops" },
      { label: "Surface", value: "Event" },
      { label: "Mode", value: "Live" },
    ],
    pipeline: ["Register", "Validate", "Coordinate", "Launch"],
    terminal: [
      "$ eclipse deploy praxis-ops",
      "registrations synced",
      "check-in desk online",
      "event control ready",
    ],
  },
  {
    id: "algohunt-base",
    title: "AlgoHunt Base",
    role: "Contest / Judge Platform",
    description:
      "The contest substrate behind algorithmic events: problem delivery, solve tracking, judge-backed feedback, and live standings.",
    metrics: [
      { label: "Judge", value: "Piston" },
      { label: "Board", value: "Live" },
      { label: "Runtime", value: "Sandbox" },
    ],
    pipeline: ["Problem", "Submit", "Judge", "Rank"],
    terminal: [
      "$ base run daily-arena",
      "hidden tests mounted",
      "sandbox queue bounded",
      "standings recalculated",
    ],
  },
];

export const timeline = [
  {
    step: "01",
    title: "Ideate",
    body: "Start with a campus problem: learning gaps, contest friction, event scale, or solver motivation.",
  },
  {
    step: "02",
    title: "Build",
    body: "Turn the idea into a usable system with tight scopes, real interfaces, and measurable outcomes.",
  },
  {
    step: "03",
    title: "Test",
    body: "Put it in front of students early, observe failure modes, and tune the experience before launch.",
  },
  {
    step: "04",
    title: "Launch",
    body: "Run the initiative as a live operation with clear ownership, support loops, and technical monitoring.",
  },
  {
    step: "05",
    title: "Iterate",
    body: "Fold learnings back into the next event, platform release, or competitive programming track.",
  },
];

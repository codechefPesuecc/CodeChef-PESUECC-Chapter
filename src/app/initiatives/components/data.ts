export const stats = [
  { label: "Flagship Events", value: "3+", progress: 92 },
  { label: "Production Platforms", value: "2", progress: 79 },
  { label: "Students Reached", value: "500+", progress: 66 },
  { label: "Culture", value: "Daily CP", progress: 53 },
];

export const opsMetrics = [
  { label: "Active Nodes", value: "12/12", progress: 100 },
  { label: "Pipeline Load", value: "78%", progress: 78 },
  { label: "Global Uptime", value: "99.9%", progress: 99 },
  { label: "Recent Deploys", value: "4", progress: 100 },
];

export const events = [
  {
    id: "leetcode-101",
    title: "LeetCode 101",
    category: "Learning Pipeline",
    status: "Cohort Program",
    cadence: "Weekly foundations",
    description:
      "A guided problem-solving pipeline for students moving from syntax comfort to interview-ready competitive thinking. The program bridges the gap between basic coding knowledge and the advanced pattern recognition required to clear technical assessments. It focuses heavily on understanding core algorithmic templates, time-complexity analysis, and translating intuitive logic into optimal code blocks.",
    detailedExplanation:
      "LeetCode 101 is our flagship mentorship program engineered to systematically break down data structures and algorithms. Rather than just grinding problems, we focus on recognizing underlying patterns—like sliding window, two pointers, and dynamic programming state transitions. Through weekly whiteboard sessions and editorial discussions, participants learn to dissect optimal solutions and articulate their thought processes exactly as required in top-tier technical interviews.",
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
      "A physical-digital contest where algorithms unlock checkpoints, clues, and leaderboard momentum across campus. Teams must rapidly decipher algorithmic puzzles that map directly to physical locations, combining high-speed physical coordination with intense technical problem-solving. It's an immersive race designed to test both computational thinking and team execution under severe time constraints.",
    detailedExplanation:
      "AlgoHunt transforms competitive programming into a high-octane physical reality. Teams are given encrypted algorithmic puzzles that, once solved, yield location-based clues around the PESU campus. It demands a unique hybrid of rapid code execution, team communication under pressure, and physical stamina. AlgoHunt tests not just how well you know Dijkstra's algorithm, but how fast your team can debug it while racing against the clock to the next checkpoint.",
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
      "A high-pressure build sprint for shipping AI-assisted products, prototypes, and technical demos under real constraints. Unlike traditional hackathons, Praxis emphasizes the speed of shipping a minimum viable product by leveraging modern AI tools and robust architectural templates. Participants learn how to rapidly iterate, integrate external APIs, and present their engineering choices to a technical jury.",
    detailedExplanation:
      "Praxis is designed to push developers out of tutorial hell and into the builder's mindset. It is a time-boxed, high-intensity hackathon where teams are challenged to ideate, architecture, and deploy functional prototypes using modern stacks and AI tooling. We emphasize product viability, clean code architecture, and effective presentation. The judging criteria strictly reward working demos over slide decks, forcing participants to make pragmatic engineering trade-offs to cross the finish line.",
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
      "The unified operations layer driving all large-scale chapter launches. Eclipse handles high-volume concurrent registrations, seamless QR-based check-ins, dynamic team formation flows, and real-time event control. By abstracting away logistical friction, it allows organizers to monitor crowd flow, issue bulk announcements, and execute complex multi-stage events with military precision from a single centralized dashboard.",
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
      "The custom-built contest substrate powering our most intense algorithmic events. Built around a robust, isolated sandboxing engine (Piston), it provides secure code execution, real-time judge feedback, and live standings recalculation under heavy load. AlgoHunt Base supports hidden test cases, multi-language compilation, and custom scoring logic, creating an incredibly tight feedback loop for competitive solvers.",
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
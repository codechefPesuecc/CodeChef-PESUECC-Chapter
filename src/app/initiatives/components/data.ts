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
    id: "cp-arena",
    title: "CP Arena",
    category: "Competitive Programming",
    status: "Active Platform",
    cadence: "24/7 Availability",
    description:
      "Our dedicated platform for daily competitive programming challenges, rigorous upsolving, and rank-based leaderboards. CP Arena provides an isolated, high-performance environment where members can tackle curated problem sets from Codeforces, CodeChef, and AtCoder without distractions. It's the central hub for our coding culture, tracking daily streaks and competitive milestones.",
    detailedExplanation:
      "CP Arena is the backbone of our daily coding culture. It functions as a persistent, gamified environment where students engage in rigorous problem-solving and peer-to-peer competition. By integrating with major judging platforms, CP Arena provides real-time analytics on time complexity optimization, algorithmic accuracy, and growth trajectories. It's not just a practice ground; it's a proving ground where theoretical algorithms meet hard competitive constraints.",
    highlights: ["Daily Problem Sets", "Global Leaderboards", "Upsolving Tracker"],
    accent: "01",
    image: "/dev-team.jpg",
    gallery: [
      { src: "/dev-team.jpg", caption: "Live contest dashboard" },
      { src: "/dev-team.jpg", caption: "Performance analytics" },
      { src: "/dev-team.jpg", caption: "Global standing tracking" },
    ],
    href: "/cp-arena",
  },
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
    accent: "02",
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
    accent: "03",
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
    accent: "04",
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
    role: "Hackathon Management",
    description:
      "Our end-to-end hackathon event management platform. Eclipse acts as the central nervous system during our flagship events, handling everything from initial team registrations to live crowd control on the day of the event. It streamlines the entire participant lifecycle, abstracting away logistical friction so we can manage hundreds of hackers seamlessly from a unified dashboard.",
    metrics: [
      { label: "Flow", value: "End-to-End" },
      { label: "Load", value: "High-Volume" },
      { label: "Role", value: "Ops Layer" },
    ],
    pipeline: ["Register", "Check-in", "Coordinate", "Manage"],
    terminal: [
      "$ eclipse init hackathon-ops",
      "registration portal live",
      "crowd control modules active",
      "handling live traffic...",
    ],
  },
  {
    id: "algohunt-base",
    title: "AlgoHunt Base",
    role: "Multi-Language Contest Engine",
    description:
      "The dedicated technical platform built to power our competitive coding hackathons. At its core, AlgoHunt Base utilizes the Piston engine to provide a secure, isolated sandbox for code execution across multiple programming languages. It acts as the backbone for algorithmic events, offering a reliable, high-performance environment for compiling submissions and evaluating solver logic in real-time.",
    metrics: [
      { label: "Engine", value: "Piston" },
      { label: "Lang", value: "Multi" },
      { label: "Runtime", value: "Sandbox" },
    ],
    pipeline: ["Code", "Submit", "Compile", "Execute"],
    terminal: [
      "$ base mount piston-engine",
      "sandbox isolation verified",
      "multi-lang compilers loaded",
      "awaiting submissions...",
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
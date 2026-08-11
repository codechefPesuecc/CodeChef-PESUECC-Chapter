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
  registrationUrl?: string;
  registrationDeadline?: string;
  winners?: { name: string; team?: string; prize: string; image?: string }[];
  judges?: { name: string; role: string; company?: string; image?: string }[];
  judgeComments?: { judgeName: string; comment: string }[];
  gallery?: string[];
}

export const events: EventData[] = [
  {
    slug: "praxis-2024",
    title: "Praxis 2024",
    tagline: "Build. Ship. Win.",
    date: "October 2024",
    location: "PES University, ECC Campus",
    type: "Hackathon",
    status: "completed",
    image: "/events/praxis-2024.jpg",
    summary:
      "Praxis 2024 was the chapter's flagship 24-hour hackathon that brought together developers, designers, and innovators from across Bangalore to build real products under pressure.",
    description: [
      "Praxis 2024 was a high-intensity 24-hour hackathon organized by the CodeChef PESUECC Chapter. Over 200 participants formed teams of 2–4 and tackled real-world problem statements spanning fintech, ed-tech, healthtech, and sustainability.",
      "The event featured mentorship from industry professionals, midnight energy boosters, and a rigorous judging process led by senior engineers from top startups. Teams were evaluated on innovation, technical execution, design, and real-world viability.",
      "Praxis wasn't just about code — it was a full-stack experience. From ideation workshops before the clock started, to a demo day where the top 10 teams pitched on stage, the event pushed every participant to think beyond the terminal.",
    ],
    highlights: [
      { label: "Participants", value: "200+" },
      { label: "Teams", value: "55" },
      { label: "Prize Pool", value: "₹50,000" },
      { label: "Duration", value: "24 Hours" },
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
    winners: [
      { name: "Team Alpha", team: "NexGen", prize: "1st Place — ₹25,000", image: "/placeholder-avatar.jpg" },
      { name: "Team Beta", team: "CodeCrafters", prize: "2nd Place — ₹15,000", image: "/placeholder-avatar.jpg" },
      { name: "Team Gamma", team: "ByteForce", prize: "3rd Place — ₹10,000", image: "/placeholder-avatar.jpg" },
    ],
    judges: [
      { name: "Judge Name 1", role: "Senior Engineer", company: "Company A", image: "/placeholder-avatar.jpg" },
      { name: "Judge Name 2", role: "CTO", company: "Company B", image: "/placeholder-avatar.jpg" },
      { name: "Judge Name 3", role: "Lead Developer", company: "Company C", image: "/placeholder-avatar.jpg" },
    ],
    judgeComments: [
      { judgeName: "Judge Name 1", comment: "The quality of projects this year was exceptional. Teams demonstrated real-world problem solving with polished execution." },
      { judgeName: "Judge Name 2", comment: "I was impressed by how teams balanced innovation with feasibility. Several projects could genuinely be shipped as products." },
    ],
    gallery: [
      "/events/praxis-2024.jpg",
      "/events/praxis-2024.jpg",
      "/events/praxis-2024.jpg",
      "/events/praxis-2024.jpg",
    ],
  },
  {
    slug: "algohunt",
    title: "AlgoHunt",
    tagline: "Decode. Discover. Dominate.",
    date: "August 2024",
    location: "PES University, ECC Campus",
    type: "Treasure Hunt × Hackathon",
    status: "completed",
    image: "/events/algohunt.jpg",
    summary:
      "AlgoHunt merged competitive programming with a physical treasure hunt — teams solved algorithmic clues scattered across campus to unlock the next challenge.",
    description: [
      "AlgoHunt was a one-of-a-kind hybrid event that combined the thrill of a campus-wide treasure hunt with the mental intensity of competitive programming. Teams of 3 raced through a series of algorithmic challenges, each solved problem revealing a physical clue hidden somewhere on campus.",
      "The event was designed to test both coding skills and teamwork. Clues required participants to decode ciphers, solve graph problems on paper, and even reverse-engineer binary sequences to find GPS coordinates. The first team to crack all stages and reach the final checkpoint won.",
      "AlgoHunt attracted participation from multiple colleges across Bangalore, making it one of the chapter's most talked-about inter-college events. The format was novel enough that teams had to strategize — split up to hunt, or stay together to code?",
    ],
    highlights: [
      { label: "Teams", value: "40+" },
      { label: "Stages", value: "7" },
      { label: "Campuses", value: "5" },
      { label: "Duration", value: "5 Hours" },
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
    winners: [
      { name: "Team Winner 1", prize: "1st Place", image: "/placeholder-avatar.jpg" },
      { name: "Team Winner 2", prize: "2nd Place", image: "/placeholder-avatar.jpg" },
      { name: "Team Winner 3", prize: "3rd Place", image: "/placeholder-avatar.jpg" },
    ],
    judges: [
      { name: "Mentor Name 1", role: "Faculty Advisor", company: "PES University", image: "/placeholder-avatar.jpg" },
      { name: "Mentor Name 2", role: "Alumni", company: "Tech Company", image: "/placeholder-avatar.jpg" },
    ],
    gallery: [
      "/events/algohunt.jpg",
      "/events/algohunt.jpg",
      "/events/algohunt.jpg",
    ],
  },
  {
    slug: "leetcode101",
    title: "LeetCode 101",
    tagline: "From Zero to Interview-Ready.",
    date: "September 2024",
    location: "PES University, ECC Campus",
    type: "Workshop Series",
    status: "completed",
    image: "/events/leetcode101.jpg",
    summary:
      "LeetCode 101 was a structured workshop series designed to take students from DSA fundamentals to confidently solving medium-level interview problems.",
    description: [
      "LeetCode 101 was a 3-week structured workshop series run by the CodeChef PESUECC Chapter, aimed at students preparing for technical interviews and competitive programming contests. The series covered arrays, strings, hashmaps, two pointers, sliding windows, recursion, trees, graphs, and dynamic programming.",
      "Each session was led by experienced problem setters and seniors who broke down patterns rather than just solutions. Participants didn't just solve problems — they learned to recognize categories, choose the right approach, and optimize under time pressure.",
      "The series included live problem-solving sessions, take-home problem sets graded on an internal leaderboard, and a final mock contest that simulated a real interview coding round. Over 120 students completed the full series.",
    ],
    highlights: [
      { label: "Sessions", value: "9" },
      { label: "Attendees", value: "120+" },
      { label: "Topics", value: "12" },
      { label: "Duration", value: "3 Weeks" },
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
    judges: [
      { name: "Instructor Name 1", role: "Problem Setter", company: "CodeChef Chapter", image: "/placeholder-avatar.jpg" },
      { name: "Instructor Name 2", role: "Senior Member", company: "CodeChef Chapter", image: "/placeholder-avatar.jpg" },
    ],
  },
];

export function getEventBySlug(slug: string): EventData | undefined {
  return events.find((e) => e.slug === slug);
}

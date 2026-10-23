// Content must be approved by Aniket before 18 Oct; the same rules are used in the briefing.

export interface RuleItem {
  title: string;
  body: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export const EVENT_FACTS = {
  date: "24 Oct 2026",
  time: "11:00 AM – 2:00 PM",
  venue: "Seminar Hall 2, PES University (ECC)",
  eligibility: "Open to all colleges",
  contacts: [
    { name: "Aniket Barun", phone: "9431515754" },
    { name: "Om Kishore Dash", phone: "6284123362" },
  ],
} as const;

export const RULES: RuleItem[] = [
  {
    title: "Registered teams only",
    body: "Only registered teams can take part. Use only your own team's login; never share it with or use the login of another team.",
  },
  {
    title: "How progression works",
    body: "There are 10 questions, each harder than the last. Question 1 is open to every team. Solve your current question, then follow the clue book to any QR hidden on campus, scan it on a phone and enter its code on your laptop to unlock the next question. Solving the final question finishes the hunt; no code is needed after it.",
  },
  {
    title: "QR codes are scarce and single-use",
    body: "There are fewer QR codes than teams need, so search fast. Any QR unlocks whichever question you are on, but once a team uses its code, it's invalid for everyone. Scanning a code doesn't reserve it: another team can still use it first. You may collect codes early and keep them: a code is used up only when your team enters it after solving your current question.",
  },
  {
    title: "No going back",
    body: "Once you move past a question, it can't be reopened.",
  },
  {
    title: "Handling QR codes",
    body: "You may tear a QR after scanning it. Damaging anything else (walls, notice boards, property), moving QRs to new spots, or hiding them is not allowed.",
  },
  {
    title: "Fair play between teams",
    body: "Don't share solutions with other teams, and don't interfere with them: no following, blocking or misleading other teams.",
  },
  {
    title: "Campus safety",
    body: "Stay out of restricted areas and follow campus safety rules. Don't run in corridors or labs.",
  },
  {
    title: "One laptop per team",
    body: "Your team plays on one laptop, kept in Seminar Hall 2 with at least one member always with it: solve questions and enter codes there. Only one device can be logged in to your team at a time. Logging in on another device signs the first one out, and the organizers are alerted. Phones are only for scanning QR codes and reading the clue book.",
  },
  {
    title: "Stay in full screen",
    body: "AlgoHunt runs in full screen on laptops. Leaving full screen, switching tabs or opening other apps adds an integrity flag, recorded with how long you were away. Every team's flag count is shown on the leaderboard. If a team collects too many flags, the core team and volunteers decide what happens to it. Use Chrome or Edge.",
  },
  {
    title: "Time limit",
    body: "Play stops automatically at 2:00 PM. From then on, runs, submissions and code entry are closed for every team, so submit before the clock reaches zero.",
  },
  {
    title: "No exploiting the platform",
    body: "Don't try to exploit or bypass the Arena or the hunt platform. If something looks broken, tell a volunteer.",
  },
  {
    title: "No AI tools",
    body: "AI tools such as ChatGPT are not allowed during the hunt.",
  },
  {
    title: "Verification and penalties",
    body: "Organizers may verify any team's work at any time. Breaking the rules can lead to penalties or disqualification. The organizers' decision is final.",
  },
];

export const FAQ: FaqItem[] = [
  {
    q: "How does AlgoHunt work?",
    a: "Solve your current question, then follow the clue book to any QR hidden on campus and enter its code to unlock the next question. Repeat until you solve the final question, which finishes the hunt.",
  },
  {
    q: "Does solving a question unlock the next one?",
    a: "No. You also need a code from a QR found on campus.",
  },
  {
    q: "What if another team already used the code I found?",
    a: "Keep searching. Codes are single-use, so the first team to enter one wins it.",
  },
  {
    q: "Is each QR for a specific question?",
    a: "No. Any QR unlocks whichever question you are on, but each one works only once.",
  },
  {
    q: "Are there enough QR codes for every team?",
    a: "No. There are fewer QR codes than teams need, so search fast.",
  },
  {
    q: "Do I need a code after the last question?",
    a: "No. Solving the final question finishes the hunt.",
  },
  {
    q: "Can we go back to an earlier question?",
    a: "No. Once you move past a question, it can't be reopened.",
  },
  {
    q: "Can teammates collaborate?",
    a: "Yes, within your own team.",
  },
  {
    q: "Can we use our phones?",
    a: "Only to scan QR codes and read the clue book. Log in, solve and enter codes on your team's laptop. Logging in on a phone signs your laptop out and alerts the organizers.",
  },
  {
    q: "Can we use AI tools?",
    a: "No. AI tools such as ChatGPT are not allowed.",
  },
  {
    q: "Can we use two laptops?",
    a: "No. Only one device can be logged in to your team at a time; logging in on a second one signs the first one out. Teammates can help solve on that one laptop.",
  },
  {
    q: "What happens if we leave full screen or switch tabs?",
    a: "Your team gets an integrity flag, recorded with how long you were away. Your flag count shows next to the timer and on the leaderboard for every team to see. Click Enter full screen to carry on.",
  },
  {
    q: "What happens at 2:00 PM?",
    a: "Play stops automatically: runs, submissions and code entry close. A submission that was already being judged still counts if it's accepted.",
  },
  {
    q: "What if the website fails?",
    a: "Contact a volunteer. Don't try to bypass it.",
  },
  {
    q: "When and where is AlgoHunt 2.0?",
    a: `${EVENT_FACTS.date}, ${EVENT_FACTS.time}, ${EVENT_FACTS.venue}. ${EVENT_FACTS.eligibility}, in teams of 2 to 4. Contacts: ${EVENT_FACTS.contacts.map((c) => `${c.name} (${c.phone})`).join(" and ")}.`,
  },
];

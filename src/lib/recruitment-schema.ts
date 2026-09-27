export const RECRUITMENT_DOMAINS = [
  "Competitive Programming",
  "Technical",
  "Design",
  "Events",
  "Sponsorship",
  "Social Media & Marketing",
] as const;

export type RecruitmentDomain = (typeof RECRUITMENT_DOMAINS)[number];

export const DOMAIN_SHORT_NAMES: Record<RecruitmentDomain, string> = {
  "Competitive Programming": "CP",
  Technical: "TECH",
  Design: "DESIGN",
  Events: "EVENTS",
  Sponsorship: "SPONSOR",
  "Social Media & Marketing": "MARKETING",
};

export type QuestionType = "text" | "textarea" | "choice" | "checks" | "scale";

export interface RecruitmentQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  help?: string;
  options?: string[];
  maxWords?: number;
  placeholder?: string;
  contextHtml?: string;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
}

export const HEARD_FROM_OPTIONS = [
  "Instagram",
  "A friend or senior",
  "Class announcement",
  "Our website",
  "Other",
];

export const YEAR_OF_STUDY_OPTIONS = ["1st", "2nd", "3rd", "4th"];

export const BRANCH_OPTIONS = ["CSE", "AI-ML", "ECE", "Others"];

export const DOMAIN_QUESTIONS: Record<RecruitmentDomain, RecruitmentQuestion[]> = {
  "Competitive Programming": [
    {
      id: "cp_handles",
      label: "Your handles: CodeChef / Codeforces / LeetCode",
      type: "textarea",
      required: true,
      help: 'Paste profile links or usernames separated by new line. Write "none yet" if you are just starting.',
      placeholder: "e.g.\nhttps://codeforces.com/profile/username\nhttps://leetcode.com/username\nhttps://www.codechef.com/users/username",
    },
    {
      id: "cp_solved_count",
      label: "Roughly how many problems have you solved overall?",
      type: "text",
      required: true,
      help: 'Write "none yet" if you are just starting.',
      placeholder: "e.g. 50 on LeetCode, 20 on CodeChef",
    },
    {
      id: "cp_problem_setting",
      label: "Would you be interested in setting problems for our contests?",
      type: "choice",
      required: true,
      options: ["Yes", "Maybe later", "No"],
    },
    {
      id: "cp_watermelon_approach",
      label: "Write how you will approach this question. Write the code if you know it.",
      type: "textarea",
      required: true,
      help: "Walk us through your thought process and solution logic.",
      placeholder: "Explain your logic and write the code / approach...",
      contextHtml: `
        <div class="rounded-xl border border-hairline bg-canvas/60 p-4 space-y-2 text-xs font-sans">
          <div class="flex items-center justify-between border-b border-hairline/60 pb-2">
            <h5 class="font-bold text-sm text-chocolate">A. Watermelon</h5>
            <span class="font-mono text-[11px] text-charcoal/60">time limit: 1s · memory limit: 64MB</span>
          </div>
          <p class="text-charcoal/80 leading-relaxed">
            One hot summer day Pete and his friend Billy decided to buy a watermelon. They chose the biggest and the ripest one, in their opinion. After that the watermelon was weighed, and the scales showed <em>w</em> kilos. They rushed home, dying of thirst, and decided to divide the berry, however they faced a hard problem.
          </p>
          <p class="text-charcoal/80 leading-relaxed">
            Pete and Billy are great fans of even numbers, that's why they want to divide the watermelon in such a way that each of the two parts weighs even number of kilos, at the same time it is not obligatory that the parts are equal. The boys are extremely tired and want to start their meal as soon as possible, that's why you should help them and find out, if they can divide the watermelon in the way they want. For sure, each of them should get a part of positive weight.
          </p>
          <div class="space-y-1 pt-1">
            <p class="font-semibold text-chocolate">Input:</p>
            <p class="text-charcoal/80">The first (and the only) input line contains integer number <em>w</em> (1 &le; <em>w</em> &le; 100) — the weight of the watermelon bought by the boys.</p>
          </div>
          <div class="space-y-1">
            <p class="font-semibold text-chocolate">Output:</p>
            <p class="text-charcoal/80">Print <code>YES</code>, if the boys can divide the watermelon into two parts, each of them weighing even number of kilos; and <code>NO</code> in the opposite case.</p>
          </div>
          <div class="rounded-lg bg-panel p-2.5 font-mono text-[11px] border border-hairline/60">
            <p class="text-charcoal/60">input: 8</p>
            <p class="text-chocolate font-bold">output: YES</p>
            <p class="text-charcoal/60 mt-1 text-[10px]">Note: The boys can divide the watermelon into two parts of 2 and 6 kilos respectively (or 4 and 4 kilos).</p>
          </div>
        </div>
      `,
    },
    {
      id: "cp_proficiency",
      label: "How proficient you are in this domain?",
      type: "scale",
      required: true,
      scaleMinLabel: "Least Proficient",
      scaleMaxLabel: "Most Proficient",
    },
  ],
  Design: [
    {
      id: "design_portfolio",
      label: "Portfolio, Behance, Dribbble or Instagram link (If any)",
      type: "text",
      required: true,
      help: "A Google Drive folder of your work is fine too — we just need to see something.",
      placeholder: "https://behance.net/... or Drive link",
    },
    {
      id: "design_tools",
      label: "Tools you use",
      type: "checks",
      required: false,
      options: [
        "Figma",
        "Canva",
        "Photoshop",
        "Illustrator",
        "Premiere / After Effects",
        "Blender",
        "Other",
      ],
    },
    {
      id: "design_critique",
      label: "Link one piece you made, and tell us what you would change about it today",
      type: "textarea",
      required: true,
      help: "Being able to critique your own work matters more to us than a polished portfolio.",
    },
    {
      id: "design_proficiency",
      label: "How proficient you are in this domain?",
      type: "scale",
      required: true,
      scaleMinLabel: "Least Proficient",
      scaleMaxLabel: "Most Proficient",
    },
  ],
  Events: [
    {
      id: "events_experience",
      label: "Describe one event you helped run — your specific role, not the team’s (if volunteered)",
      type: "textarea",
      required: true,
      help: 'Write "none yet" if this would be your first; that is genuinely fine.',
    },
    {
      id: "events_hours",
      label: "Hours per week you can realistically give",
      type: "choice",
      required: true,
      options: ["1-2", "3-5", "6-10", "More than 10"],
    },
    {
      id: "events_scenario",
      label: "It is 10 minutes before a workshop for 60 people and the projector dies. What do you do?",
      type: "textarea",
      required: true,
      help: "Walk us through it.",
    },
    {
      id: "events_unique_idea",
      label: "You are organizing an event for 60 people. What would you conduct? Give us your most unique idea.",
      type: "textarea",
      required: true,
      placeholder: "Describe the event format, theme, activities, and why students would love it...",
    },
    {
      id: "events_proficiency",
      label: "How proficient you are in this domain?",
      type: "scale",
      required: true,
      scaleMinLabel: "Least Proficient",
      scaleMaxLabel: "Most Proficient",
    },
  ],
  Technical: [
    {
      id: "tech_github",
      label: "GitHub profile link",
      type: "text",
      required: true,
      placeholder: "https://github.com/username",
    },
    {
      id: "tech_linkedin",
      label: "LinkedIn profile link",
      type: "text",
      required: false,
      placeholder: "https://linkedin.com/in/username",
    },
    {
      id: "tech_stack",
      label: "What do you work with?",
      type: "checks",
      required: false,
      options: [
        "HTML/CSS",
        "JavaScript",
        "React / Next.js",
        "Python",
        "Node / backend",
        "Databases",
        "Docker / DevOps",
        "C++ / Java",
        "Git",
        "None of these yet",
      ],
    },
    {
      id: "tech_interest",
      label: "What interests you most?",
      type: "choice",
      required: true,
      options: [
        "Frontend",
        "Backend",
        "Infrastructure and tooling",
        "Everything",
        "Not sure yet",
      ],
    },
    {
      id: "tech_proficiency",
      label: "How proficient you are in this domain?",
      type: "scale",
      required: true,
      scaleMinLabel: "Least Proficient",
      scaleMaxLabel: "Most Proficient",
    },
  ],
  Sponsorship: [
    {
      id: "sponsor_experience",
      label: "Any outreach, sponsorship, PR or sales experience?",
      type: "textarea",
      required: true,
      help: 'Write "none yet" if not — we are happy to train.',
    },
    {
      id: "sponsor_cold_outreach",
      label: "Have you ever cold-emailed or cold-called a stranger to ask for something? What happened?",
      type: "textarea",
      required: true,
    },
    {
      id: "sponsor_connections",
      label: "Do you have any connections that could help us acquire sponsorships? If yes, please mention the company/organization and the nature of your connection.",
      type: "textarea",
      required: true,
      placeholder: "Company / organization, contact person / role, or write 'none yet'...",
    },
    {
      id: "sponsor_proficiency",
      label: "How proficient you are in this domain?",
      type: "scale",
      required: true,
      scaleMinLabel: "Least Proficient",
      scaleMaxLabel: "Most Proficient",
    },
  ],
  "Social Media & Marketing": [
    {
      id: "marketing_links",
      label: "Link a page you run, or content you have made",
      type: "text",
      required: true,
      help: "Your own account, a club page, posts, reels, articles — anything you made.",
      placeholder: "https://instagram.com/...",
    },
    {
      id: "marketing_skills",
      label: "What are you comfortable with?",
      type: "checks",
      required: false,
      options: [
        "Instagram",
        "LinkedIn",
        "X / Twitter",
        "Canva / graphics",
        "Video editing",
        "Other",
      ],
    },
    {
      id: "marketing_caption",
      label: "Write an Instagram caption announcing a 3-hour beginner-friendly coding contest with a Rs 5,000 prize pool",
      type: "textarea",
      required: true,
      maxWords: 60,
      help: "Max 60 words.",
    },
    {
      id: "marketing_proficiency",
      label: "How proficient you are in this domain?",
      type: "scale",
      required: true,
      scaleMinLabel: "Least Proficient",
      scaleMaxLabel: "Most Proficient",
    },
  ],
};

export const WRAP_UP_QUESTIONS: RecruitmentQuestion[] = [
  {
    id: "wrapup_goals",
    label: "What do you want to have built, learned or won by the end of this year with us?",
    type: "textarea",
    required: true,
    help: 'Specific beats impressive. "Reach 1400 on Codeforces" tells us more than "grow as a developer".',
  },
  {
    id: "wrapup_other_clubs",
    label: "Are you part of other clubs or committees? Which ones?",
    type: "text",
    required: false,
    placeholder: "e.g. None / GDG / IEEE / etc.",
  },
];

export function countWords(str: string): number {
  const trimmed = str.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

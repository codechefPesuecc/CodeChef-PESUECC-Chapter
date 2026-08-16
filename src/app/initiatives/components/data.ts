import manifest from "../initiatives.manifest.json";

export const events = manifest.events;
export const systems = manifest.systems;

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

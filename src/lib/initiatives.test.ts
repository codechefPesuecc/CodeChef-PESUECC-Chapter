import { describe, it, expect } from "vitest";
import { getAllEvents, getEventBySlug, getEventSlugs, getAllSystems } from "./initiatives";

describe("initiatives data layer", () => {
  it("loads all core events", () => {
    const events = getAllEvents();
    expect(events.length).toBeGreaterThanOrEqual(4);
    
    const ids = events.map((e) => e.id);
    expect(ids).toContain("algohunt");
    expect(ids).toContain("cp-arena");
    expect(ids).toContain("leetcode-101");
    expect(ids).toContain("praxis");
  });

  it("retrieves a single event by slug", () => {
    const event = getEventBySlug("algohunt");
    expect(event).not.toBeNull();
    expect(event?.title).toBe("AlgoHunt");
    expect(event?.cardBrief).toBeDefined();
    expect(event?.detailedExplanation).toBeDefined();
    expect(event?.timeline).toBeInstanceOf(Array);
  });

  it("returns null for unknown slugs without throwing", () => {
    const event = getEventBySlug("non-existent-initiative");
    expect(event).toBeNull();
  });

  it("returns valid event slugs for static generation", () => {
    const slugs = getEventSlugs();
    expect(slugs).toBeInstanceOf(Array);
    expect(slugs).toContain("algohunt");
  });

  it("loads systems portfolio", () => {
    const systems = getAllSystems();
    expect(systems.length).toBeGreaterThanOrEqual(2);
    const ids = systems.map((s) => s.id);
    expect(ids).toContain("algohunt-base");
    expect(ids).toContain("eclipse");
  });

  it("guarantees safe default fallbacks for missing optional fields", () => {
    const events = getAllEvents();
    for (const event of events) {
      expect(Array.isArray(event.highlights)).toBe(true);
      expect(Array.isArray(event.gallery)).toBe(true);
      expect(Array.isArray(event.timeline)).toBe(true);
      expect(Array.isArray(event.mentors)).toBe(true);
      expect(Array.isArray(event.winners)).toBe(true);
      expect(typeof event.cardBrief).toBe("string");
      expect(event.cardBrief.length).toBeGreaterThan(0);
    }
  });

  it("supports multi-track event winners with distinct podiums", () => {
    const algohunt = getEventBySlug("algohunt");
    expect(algohunt).not.toBeNull();
    expect(algohunt?.winners.length).toBeGreaterThanOrEqual(6);

    const tracks = Array.from(new Set(algohunt?.winners.map((w) => w.track).filter(Boolean)));
    expect(tracks).toContain("Easy Track");
    expect(tracks).toContain("Tough Track");

    const easyWinners = algohunt?.winners.filter((w) => w.track === "Easy Track");
    const toughWinners = algohunt?.winners.filter((w) => w.track === "Tough Track");

    expect(easyWinners?.length).toBe(3);
    expect(toughWinners?.length).toBe(3);

    // Each track has its own 1st place champion with custom badge
    expect(easyWinners?.[0].achievement).toBe("1st Place Champions");
    expect(easyWinners?.[0].badge).toBe("Easy Track Champions");
    expect(toughWinners?.[0].achievement).toBe("1st Place Champions");
    expect(toughWinners?.[0].badge).toBe("Tough Track Champions");
  });
});

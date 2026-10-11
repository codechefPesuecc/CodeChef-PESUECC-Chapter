import { describe, expect, it } from "vitest";
import {
  NAV_LINKS, pickDefaultEvent, resolveSelectedEvent, statusTone, switchEventHref, isLinkActive, withEvent,
  type NavEvent,
} from "./navModel";

const ev = (slug: string, over: Partial<NavEvent> = {}): NavEvent => ({
  id: slug, slug, name: slug, status: "DRAFT", isTest: false, ...over,
});

describe("pickDefaultEvent", () => {
  it("prefers the newest non-test, non-archived event", () => {
    const events = [ev("test", { isTest: true }), ev("real"), ev("old", { status: "ARCHIVED" })];
    expect(pickDefaultEvent(events)?.slug).toBe("real");
  });

  it("falls back to the newest event, then to null", () => {
    expect(pickDefaultEvent([ev("a", { isTest: true }), ev("b", { status: "ARCHIVED" })])?.slug).toBe("a");
    expect(pickDefaultEvent([])).toBeNull();
  });
});

describe("resolveSelectedEvent", () => {
  const events = [ev("one"), ev("two")];
  it("uses ?event= when it names a real event", () => {
    expect(resolveSelectedEvent(events, "two")?.slug).toBe("two");
  });
  it("falls back to the default for a missing or unknown slug", () => {
    expect(resolveSelectedEvent(events, null)?.slug).toBe("one");
    expect(resolveSelectedEvent(events, "nope")?.slug).toBe("one");
  });
});

describe("links", () => {
  it("lists all 12 destinations once, all under /admin/algohunt", () => {
    expect(NAV_LINKS).toHaveLength(12);
    expect(new Set(NAV_LINKS.map((l) => l.href)).size).toBe(12);
    expect(NAV_LINKS.every((l) => l.href.startsWith("/admin/algohunt"))).toBe(true);
  });

  it("carries the event slug, encoded", () => {
    expect(withEvent("/admin/algohunt/teams", "algohunt-2026")).toBe("/admin/algohunt/teams?event=algohunt-2026");
    expect(withEvent("/admin/algohunt", "a b&c")).toBe("/admin/algohunt?event=a%20b%26c");
    expect(withEvent("/admin/algohunt", null)).toBe("/admin/algohunt");
  });

  it("only marks Overview active on its own path, and sections by prefix", () => {
    expect(isLinkActive("/admin/algohunt", "/admin/algohunt")).toBe(true);
    expect(isLinkActive("/admin/algohunt/teams", "/admin/algohunt")).toBe(false);
    expect(isLinkActive("/admin/algohunt/teams/abc", "/admin/algohunt/teams")).toBe(true);
    expect(isLinkActive("/admin/algohunt/teamsx", "/admin/algohunt/teams")).toBe(false);
  });
});

describe("switchEventHref", () => {
  it("keeps the page when switching events", () => {
    expect(switchEventHref("/admin/algohunt/control", "b")).toBe("/admin/algohunt/control?event=b");
  });
  it("leaves a team page, which belongs to one event", () => {
    expect(switchEventHref("/admin/algohunt/teams/team-123", "b")).toBe("/admin/algohunt?event=b");
    expect(switchEventHref("/admin/algohunt/teams", "b")).toBe("/admin/algohunt/teams?event=b");
  });
});

describe("statusTone", () => {
  it("is green for LIVE, red for PAUSED, grey for everything else", () => {
    expect(statusTone("LIVE")).toBe("live");
    expect(statusTone("PAUSED")).toBe("paused");
    for (const s of ["DRAFT", "CHECK_IN", "READY", "ENDED", "ARCHIVED"] as const) {
      expect(statusTone(s)).toBe("idle");
    }
  });
});

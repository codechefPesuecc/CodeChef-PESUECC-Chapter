import { describe, it, expect } from "vitest";
import { isGoogleFormUrl, toEmbedUrl, toShareUrl } from "./recruitment";

const FORM = "https://docs.google.com/forms/d/e/1FAIpQLSc-example/viewform";

describe("isGoogleFormUrl", () => {
  it("accepts a Google Forms viewform URL", () => {
    expect(isGoogleFormUrl(FORM)).toBe(true);
  });

  it("accepts the embed URL Google's <> dialog hands out", () => {
    expect(isGoogleFormUrl(`${FORM}?embedded=true`)).toBe(true);
  });

  it("tolerates surrounding whitespace from a paste", () => {
    expect(isGoogleFormUrl(`  ${FORM}  `)).toBe(true);
  });

  it("rejects http — the frame must be https", () => {
    expect(isGoogleFormUrl(FORM.replace("https:", "http:"))).toBe(false);
  });

  it("rejects another host entirely", () => {
    expect(isGoogleFormUrl("https://example.test/forms/d/e/x/viewform")).toBe(false);
  });

  it("rejects a suffixed lookalike host", () => {
    // Parses to the host `docs.google.com.evil.test`, not `docs.google.com`.
    expect(
      isGoogleFormUrl("https://docs.google.com.evil.test/forms/d/e/x/viewform"),
    ).toBe(false);
  });

  it("rejects a userinfo-prefixed lookalike", () => {
    // Everything before the `@` is credentials; the real host is `evil.test`.
    expect(
      isGoogleFormUrl("https://docs.google.com@evil.test/forms/d/e/x/viewform"),
    ).toBe(false);
  });

  it("rejects a non-forms path on the right host", () => {
    expect(isGoogleFormUrl("https://docs.google.com/document/d/abc/edit")).toBe(false);
  });

  it("rejects a javascript: payload", () => {
    expect(isGoogleFormUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects unparseable and empty input", () => {
    expect(isGoogleFormUrl("not a url")).toBe(false);
    expect(isGoogleFormUrl("")).toBe(false);
  });
});

describe("toEmbedUrl", () => {
  it("adds embedded=true to a plain viewform URL", () => {
    expect(toEmbedUrl(FORM)).toBe(`${FORM}?embedded=true`);
  });

  it("is idempotent — pasting the embed URL doesn't duplicate the param", () => {
    const once = toEmbedUrl(FORM);
    expect(toEmbedUrl(once)).toBe(once);
  });

  it("preserves other query params", () => {
    const withParam = `${FORM}?usp=sf_link`;
    const embedded = toEmbedUrl(withParam);
    expect(embedded).toContain("usp=sf_link");
    expect(embedded).toContain("embedded=true");
  });

  it("returns unparseable input untouched rather than throwing", () => {
    expect(toEmbedUrl("not a url")).toBe("not a url");
  });
});

describe("toShareUrl", () => {
  it("strips embedded=true so the fallback tab shows the full form", () => {
    expect(toShareUrl(`${FORM}?embedded=true`)).toBe(FORM);
  });

  it("leaves a URL without the param alone", () => {
    expect(toShareUrl(FORM)).toBe(FORM);
  });

  it("round-trips with toEmbedUrl", () => {
    expect(toShareUrl(toEmbedUrl(FORM))).toBe(FORM);
  });

  it("returns unparseable input untouched rather than throwing", () => {
    expect(toShareUrl("not a url")).toBe("not a url");
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkOrigin, fail, parseBody } from "./http";

const schema = z.object({ name: z.string() }).strict();
const url = "https://chapter.example/api/algohunt/test";

function request(body: string, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("checkOrigin", () => {
  it("allows a matching origin", () => {
    expect(checkOrigin(request("{}", { origin: "https://chapter.example" }))).toBeNull();
  });

  it("blocks a foreign origin", async () => {
    const response = checkOrigin(request("{}", { origin: "https://other.example" }));
    expect(response?.status).toBe(403);
    expect(await response?.json()).toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a missing origin", () => {
    expect(checkOrigin(request("{}"))).toBeNull();
  });
});

describe("parseBody", () => {
  it("rejects a non-JSON content type", async () => {
    const result = await parseBody(request("{}", { "content-type": "text/plain" }), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const result = await parseBody(request("{"), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(await result.response.json()).toMatchObject({ code: "VALIDATION", error: "Invalid JSON body." });
  });

  it("rejects an extra field with a strict schema", async () => {
    const result = await parseBody(request(JSON.stringify({ name: "A", teamId: "forged" })), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(await result.response.json()).toMatchObject({ code: "VALIDATION" });
  });

  it("returns validated data", async () => {
    const result = await parseBody(request(JSON.stringify({ name: "A" })), schema);
    expect(result).toEqual({ ok: true, data: { name: "A" } });
  });
});

describe("fail", () => {
  it("sets Retry-After for rate limits", async () => {
    const response = fail("RATE_LIMITED", undefined, { retryAfterSeconds: 2.2 });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
    expect(await response.json()).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });
});

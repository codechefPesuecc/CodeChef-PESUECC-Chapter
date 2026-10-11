import { afterEach, describe, expect, it, vi } from "vitest";
import { adminFetch } from "./adminFetch";

function stubFetch(impl: () => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("adminFetch", () => {
  it("sends a JSON body and returns the success payload", async () => {
    const fn = stubFetch(async () => Response.json({ ok: true, event: { status: "LIVE" } }));
    const data = await adminFetch<{ event: { status: string } }>("POST", "/api/x", { to: "LIVE" });
    expect(data.event.status).toBe("LIVE");
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/x");
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify({ to: "LIVE" }) });
    expect(init.headers).toEqual({ "content-type": "application/json" });
  });

  it("sends no content-type when there is no body", async () => {
    const fn = stubFetch(async () => Response.json({ ok: true }));
    await adminFetch("POST", "/api/x");
    const init = (fn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("throws the server's own sentence on a failure", async () => {
    stubFetch(async () => Response.json({ ok: false, error: "Confirmation text does not match.", code: "VALIDATION" }, { status: 400 }));
    await expect(adminFetch("POST", "/api/x", {})).rejects.toThrow("Confirmation text does not match.");
  });

  it("gives a safe message for a non-JSON error page", async () => {
    stubFetch(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    await expect(adminFetch("POST", "/api/x", {})).rejects.toThrow("The request failed");
  });

  it("explains a network failure without claiming nothing changed", async () => {
    stubFetch(async () => { throw new TypeError("Failed to fetch"); });
    await expect(adminFetch("PATCH", "/api/x", {})).rejects.toThrow(/may not have gone through/);
  });
});

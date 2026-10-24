/**
 * Calls an admin API route and returns the parsed success body. Any failure becomes an Error
 * whose message is safe to show an admin (the server's own sentence, never a stack trace).
 */
export async function adminFetch<T extends object = Record<string, unknown>>(
  method: "POST" | "PATCH",
  url: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error. The change may not have gone through, so refresh the page to check.");
  }
  let data: { ok?: boolean; error?: string } | null = null;
  try {
    data = await response.json();
  } catch {
    // A non-JSON body (for example a gateway error page) is handled below.
  }
  if (!response.ok || !data || data.ok !== true) {
    throw new Error(data?.error || "The request failed. Refresh the page to see the current state.");
  }
  return data as T;
}

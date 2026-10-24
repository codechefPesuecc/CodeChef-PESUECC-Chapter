import { NextResponse } from "next/server";
import { fail, ok } from "@/server/algohunt/http";
import { requireTeam } from "@/server/algohunt/teamSession";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await requireTeam();
    if (ctx instanceof NextResponse) return ctx;
    return ok({
      team: { code: ctx.team.teamCode, name: ctx.team.teamName, status: ctx.team.status },
      event: { name: ctx.event.name, status: ctx.event.status },
      serverNow: Date.now(),
    });
  } catch (error) {
    console.error("[algohunt:me]", error);
    return fail("INTERNAL");
  }
}

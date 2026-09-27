import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/session";
import {
  getAdminApplications,
  updateApplicationStatus,
} from "@/server/recruitment-applications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  const url = new URL(req.url);
  const cycle = url.searchParams.get("cycle") || undefined;

  const applications = await getAdminApplications(cycle);
  return NextResponse.json({ ok: true, applications });
}

export async function PATCH(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  let body: {
    applicationId?: string;
    status?: string;
    reviewerNotes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.applicationId || !body.status) {
    return NextResponse.json(
      { ok: false, error: "Application ID and status are required." },
      { status: 400 },
    );
  }

  const result = await updateApplicationStatus(
    admin.id,
    body.applicationId,
    body.status,
    body.reviewerNotes,
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { deleteUser } from "@/server/admin/users";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/users/[id] — grant/revoke admin and/or teacher (admins only).
 * Body: { isAdmin?: boolean, isTeacher?: boolean }. An admin can't revoke their own
 * admin access (that would risk locking everyone out of the console).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const { id } = await params;

  let body: { isAdmin?: unknown; isTeacher?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const patch: { isAdmin?: boolean; isTeacher?: boolean } = {};
  if (typeof body.isAdmin === "boolean") patch.isAdmin = body.isAdmin;
  if (typeof body.isTeacher === "boolean") patch.isTeacher = body.isTeacher;
  if (patch.isAdmin === undefined && patch.isTeacher === undefined) {
    return NextResponse.json(
      { ok: false, error: "Nothing to update (send isAdmin and/or isTeacher)." },
      { status: 400 },
    );
  }

  if (id === admin.id && patch.isAdmin === false) {
    return NextResponse.json(
      { ok: false, error: "You can't remove your own admin access." },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
  }

  await db.update(users).set(patch).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/users/[id] — permanently remove a user and their data
 * (admins only). You can't delete your own account. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const { id } = await params;

  if (id === admin.id) {
    return NextResponse.json(
      { ok: false, error: "You can't delete your own account." },
      { status: 400 },
    );
  }

  const result = await deleteUser(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}

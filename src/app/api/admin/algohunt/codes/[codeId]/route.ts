import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { setCodeAvailability, updatePlacementNote } from "@/server/algohunt/codePool";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const patchCodeSchema = z
  .object({
    action: z.enum(["DISABLE", "ENABLE", "NOTE"]),
    reason: z.string().optional(),
    placementNote: z.string().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.action === "DISABLE" || data.action === "ENABLE") {
      const trimmed = data.reason?.trim();
      if (!trimmed || trimmed.length < 5 || trimmed.length > 500) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Reason must be between 5 and 500 characters for DISABLE or ENABLE.",
          path: ["reason"],
        });
      }
    }
    if (data.action === "NOTE") {
      if (data.placementNote === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "placementNote is required for NOTE action.",
          path: ["placementNote"],
        });
      } else if (data.placementNote.length > 200) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "placementNote cannot exceed 200 characters.",
          path: ["placementNote"],
        });
      }
    }
  });

/** PATCH /api/admin/algohunt/codes/[codeId] */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ codeId: string }> }
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const { codeId } = await params;
    if (!codeId) return fail("VALIDATION", "Code ID is required.");

    const parsed = await parseBody(req, patchCodeSchema);
    if (!parsed.ok) return parsed.response;

    if (parsed.data.action === "DISABLE" || parsed.data.action === "ENABLE") {
      const res = await setCodeAvailability({
        codeId,
        action: parsed.data.action,
        reason: parsed.data.reason!,
        adminId: admin.id,
      });
      if (!res.ok) {
        return fail(res.code, res.message);
      }
      return ok({});
    }

    if (parsed.data.action === "NOTE") {
      await updatePlacementNote({
        codeId,
        note: parsed.data.placementNote!,
        adminId: admin.id,
      });
      return ok({});
    }

    return fail("VALIDATION", "Unsupported action.");
  } catch (error) {
    console.error("[algohunt:admin:codes:patch]", error);
    return fail("INTERNAL");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { submissionStatuses } from "@/lib/submission-status";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { updateGeneralSubmission } from "@/lib/server/admin-submissions";
import { recordAuditLog } from "@/lib/server/orders";

const schema = z.object({ status: z.enum(submissionStatuses), notes: z.string().trim().max(4_000) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await context.params;
  const parsed = schema.safeParse(await readJsonBody(request, 8_000).catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Valeurs invalides." }, { status: 400 });
  }
  const updated = await updateGeneralSubmission(id, parsed.data);
  if (!updated) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  await recordAuditLog({
    action: "submission.updated",
    entityType: "submission",
    entityId: id,
    metadata: { status: parsed.data.status },
  });
  return NextResponse.json({ ok: true });
}

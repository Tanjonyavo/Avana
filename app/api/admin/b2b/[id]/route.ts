import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { b2bStages } from "@/lib/b2b";
import { updateB2BSubmission } from "@/lib/server/admin-submissions";
import { recordAuditLog } from "@/lib/server/orders";

const schema = z.object({ status: z.enum(b2bStages), notes: z.string().trim().max(4000) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Prospect invalide." }, { status: 400 });
  const parsed = schema.safeParse(await readJsonBody(request, 8_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Statut ou note invalide." }, { status: 400 });
  const updated = await updateB2BSubmission(id, parsed.data);
  if (!updated) return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });
  await recordAuditLog({
    action: "b2b.updated",
    entityType: "submission",
    entityId: id,
    metadata: { status: parsed.data.status },
  });
  return NextResponse.json({ ok: true });
}

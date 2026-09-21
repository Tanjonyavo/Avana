import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { processPendingNotifications } from "@/lib/server/notifications";
import { markOrderDelivered, markOrderProcessing, recordAuditLog } from "@/lib/server/orders";

const schema = z.object({ action: z.enum(["processing", "delivered"]) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
  const parsed = schema.safeParse(await readJsonBody(request, 8_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Action invalide." }, { status: 400 });

  const changed =
    parsed.data.action === "processing" ? await markOrderProcessing(id) : await markOrderDelivered(id);
  if (!changed)
    return NextResponse.json({ error: "Cette transition n’est pas disponible." }, { status: 409 });
  await recordAuditLog({ action: `order.${parsed.data.action}`, entityType: "order", entityId: id });
  if (parsed.data.action === "delivered") await processPendingNotifications(5);
  return NextResponse.json({ ok: true });
}

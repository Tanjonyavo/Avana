import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminShipmentSchema } from "@/lib/validation";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { processPendingNotifications } from "@/lib/server/notifications";
import { markOrderShipped, recordAuditLog } from "@/lib/server/orders";

function defaultTrackingUrl(carrier: string, trackingNumber: string) {
  const normalized = carrier.toLocaleLowerCase("fr");
  if (normalized.includes("canada") || normalized.includes("postes")) {
    return `https://www.canadapost-postescanada.ca/track-reperage/fr#/details/${encodeURIComponent(trackingNumber)}`;
  }
  if (normalized.includes("ups"))
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  if (normalized.includes("fedex"))
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
  if (normalized.includes("purolator"))
    return `https://www.purolator.com/fr/expedition/suivi?pin=${encodeURIComponent(trackingNumber)}`;
  return "";
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
  const parsed = adminShipmentSchema.safeParse(await readJsonBody(request, 8_000).catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Vérifiez les informations de suivi." }, { status: 400 });
  const trackingUrl =
    parsed.data.trackingUrl || defaultTrackingUrl(parsed.data.carrier, parsed.data.trackingNumber);
  await markOrderShipped({
    orderId: id,
    carrier: parsed.data.carrier,
    service: parsed.data.service,
    trackingNumber: parsed.data.trackingNumber,
    trackingUrl,
  });
  await recordAuditLog({
    action: "order.shipped",
    entityType: "order",
    entityId: id,
    metadata: { carrier: parsed.data.carrier, trackingNumber: parsed.data.trackingNumber },
  });
  await processPendingNotifications(5);
  return NextResponse.json({ ok: true, trackingUrl });
}

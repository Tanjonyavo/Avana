import { NextRequest, NextResponse } from "next/server";
import { orderAccessRequestSchema } from "@/lib/validation";
import { isEmailConfigured, isSupabaseAdminConfigured } from "@/lib/server/config";
import { enqueueNotification, processPendingNotifications } from "@/lib/server/notifications";
import { findOrderForAccessRequest } from "@/lib/server/orders";
import { rateLimit, requestFingerprint, sensitiveRateLimitIdentifier } from "@/lib/server/rate-limit";
import { hasValidOrigin } from "@/lib/server/request";
import { readJsonBody } from "@/lib/server/request-body";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request))
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  if (!isSupabaseAdminConfigured() || !isEmailConfigured()) {
    return NextResponse.json(
      { error: "Le suivi des commandes n’est pas encore configuré." },
      { status: 503 },
    );
  }
  if (!(await rateLimit("order-access", requestFingerprint(request), 5, 20 * 60))) {
    return NextResponse.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429 });
  }
  const parsed = orderAccessRequestSchema.safeParse(await readJsonBody(request, 4_000).catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Vérifiez le courriel et le numéro." }, { status: 400 });
  if (
    !(await rateLimit(
      "order-access-recipient",
      sensitiveRateLimitIdentifier(`${parsed.data.email}:${parsed.data.orderNumber}`),
      3,
      60 * 60,
    ))
  ) {
    return NextResponse.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429 });
  }

  const genericResponse = NextResponse.json({
    ok: true,
    message: "Si la commande correspond à ce courriel, un lien privé vient d’être envoyé.",
  });
  const order = await findOrderForAccessRequest(parsed.data.orderNumber.toUpperCase(), parsed.data.email);
  if (!order) return genericResponse;

  await enqueueNotification({
    orderId: order.id,
    kind: "order_access",
    recipientEmail: order.email,
    payload: { orderNumber: order.number },
  });
  await processPendingNotifications(5);
  return genericResponse;
}

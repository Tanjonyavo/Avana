import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminRefundSchema } from "@/lib/validation";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { processPendingNotifications } from "@/lib/server/notifications";
import {
  getAdminOrderById,
  markOrderPartiallyRefunded,
  markOrderRefunded,
  recordAuditLog,
} from "@/lib/server/orders";
import { getStripe } from "@/lib/server/stripe";
import { createRefundAuthorization } from "@/lib/server/refund-security";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
  const parsed = adminRefundSchema.safeParse(await readJsonBody(request, 8_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  const order = await getAdminOrderById(id);
  if (!order?.stripePaymentIntentId || !["paid", "partially_refunded"].includes(order.paymentStatus)) {
    return NextResponse.json({ error: "Cette commande ne peut pas être remboursée." }, { status: 409 });
  }

  const remainingCents = order.totalCents - order.refundedCents;
  const amountCents = parsed.data.amountCents ?? remainingCents;
  if (remainingCents <= 0 || amountCents > remainingCents) {
    return NextResponse.json({ error: "Le montant dépasse le solde remboursable." }, { status: 409 });
  }
  const completesRefund = amountCents === remainingCents;

  let refund;
  try {
    const restock = completesRefund && parsed.data.restock;
    refund = await getStripe().refunds.create(
      {
        payment_intent: order.stripePaymentIntentId,
        amount: amountCents,
        reason: "requested_by_customer",
        metadata: {
          orderId: id,
          restock: String(restock),
          avanaAuthorization: createRefundAuthorization(
            {
              orderId: id,
              paymentIntentId: order.stripePaymentIntentId,
              amountCents,
              restock,
            },
            process.env.SESSION_SECRET!,
          ),
        },
      },
      { idempotencyKey: `avana-refund-${id}-${order.refundedCents}` },
    );
  } catch (error) {
    console.error("AVANA refund request failed", {
      orderId: id,
      category: error instanceof Error ? error.name : "unknown",
    });
    await recordAuditLog({
      action: "order.refund_failed",
      entityType: "order",
      entityId: id,
      metadata: { amountCents },
    });
    return NextResponse.json({ error: "Stripe n’a pas accepté le remboursement." }, { status: 502 });
  }
  if (refund.status === "succeeded") {
    if (completesRefund) {
      await markOrderRefunded(id, parsed.data.restock);
    } else {
      await markOrderPartiallyRefunded(id, order.refundedCents + amountCents);
    }
    await processPendingNotifications(5);
  }
  await recordAuditLog({
    action: "order.refund_requested",
    entityType: "order",
    entityId: id,
    metadata: {
      refundId: refund.id,
      amountCents,
      restock: completesRefund && parsed.data.restock,
      status: refund.status || "unknown",
    },
  });
  if (["failed", "canceled"].includes(refund.status || "")) {
    return NextResponse.json({ error: "Le remboursement n’a pas pu être finalisé." }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    status: refund.status,
    message:
      refund.status === "succeeded"
        ? "Remboursement confirmé et notification traitée."
        : "Remboursement demandé; confirmation Stripe en attente.",
  });
}

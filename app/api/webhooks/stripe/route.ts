import { after, NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { enqueueNotification, processPendingNotifications } from "@/lib/server/notifications";
import {
  claimPaymentEvent,
  completePaymentEvent,
  failPaymentEvent,
  findOrderByPaymentIntent,
  findOrderByStripeSession,
  markOrderPartiallyRefunded,
  markOrderRefunded,
  releaseOrderReservation,
} from "@/lib/server/orders";
import { verifyRefundAuthorization } from "@/lib/server/refund-security";
import { readTextBody, RequestBodyTooLargeError } from "@/lib/server/request-body";
import { fulfillCheckoutSession } from "@/lib/server/stripe-checkout";
import { getStripe, stripeEventMatchesConfiguredMode } from "@/lib/server/stripe";

export const runtime = "nodejs";

function expandableId(value: string | { id: string } | null) {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

async function handleChargeRefunded(charge: Stripe.Charge, restock = false) {
  if (charge.amount_refunded <= 0) return undefined;
  const paymentIntentId = expandableId(charge.payment_intent);
  if (!paymentIntentId) return undefined;
  const order = await findOrderByPaymentIntent(paymentIntentId);
  if (!order) return undefined;
  if (charge.amount_refunded >= charge.amount) {
    await markOrderRefunded(order.id, restock);
  } else {
    await markOrderPartiallyRefunded(order.id, charge.amount_refunded);
  }
  return order.id;
}

async function handleSucceededRefund(refund: Stripe.Refund) {
  if (!refund.charge) return undefined;
  const charge =
    typeof refund.charge === "string" ? await getStripe().charges.retrieve(refund.charge) : refund.charge;
  const paymentIntentId = expandableId(charge.payment_intent);
  const order = paymentIntentId ? await findOrderByPaymentIntent(paymentIntentId) : null;
  if (!order) return undefined;
  const restock =
    refund.metadata?.restock === "true" &&
    verifyRefundAuthorization(
      {
        orderId: order.id,
        paymentIntentId,
        amountCents: refund.amount,
        restock: true,
      },
      refund.metadata?.avanaAuthorization,
      process.env.SESSION_SECRET || "",
    );
  return handleChargeRefunded(charge, restock);
}

async function handleFailedRefund(refund: Stripe.Refund) {
  let paymentIntentId = expandableId(refund.payment_intent);
  if (!paymentIntentId && refund.charge) {
    const charge =
      typeof refund.charge === "string" ? await getStripe().charges.retrieve(refund.charge) : refund.charge;
    paymentIntentId = expandableId(charge.payment_intent);
  }
  const order = paymentIntentId ? await findOrderByPaymentIntent(paymentIntentId) : null;
  if (!order) return undefined;
  if (process.env.ORDERS_TO_EMAIL) {
    await enqueueNotification({
      orderId: order.id,
      kind: "admin_refund_failed",
      recipientEmail: process.env.ORDERS_TO_EMAIL,
      payload: { refundId: refund.id },
      dedupeKey: `admin-refund-failed:${refund.id}`,
    });
  }
  return order.id;
}

async function releaseCheckoutSession(session: Stripe.Checkout.Session) {
  const order = await findOrderByStripeSession(session.id);
  if (!order) return undefined;
  if (session.metadata?.orderId !== order.id || session.client_reference_id !== order.id) {
    throw new Error("Stripe session order correlation mismatch");
  }
  await releaseOrderReservation(order.id, "La session de paiement a expiré ou échoué.");
  return order.id;
}

async function handleDispute(dispute: Stripe.Dispute) {
  const charge =
    typeof dispute.charge === "string" ? await getStripe().charges.retrieve(dispute.charge) : dispute.charge;
  const paymentIntentId = expandableId(charge.payment_intent);
  if (!paymentIntentId) return undefined;
  const order = await findOrderByPaymentIntent(paymentIntentId);
  if (!order) return undefined;
  if (process.env.ORDERS_TO_EMAIL) {
    await enqueueNotification({
      orderId: order.id,
      kind: "admin_dispute",
      recipientEmail: process.env.ORDERS_TO_EMAIL,
      payload: { disputeId: dispute.id, reason: dispute.reason },
      dedupeKey: `admin-dispute:${dispute.id}`,
    });
  }
  return order.id;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await readTextBody(request, 1_000_000),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Événement trop volumineux." }, { status: 413 });
    }
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  if (!stripeEventMatchesConfiguredMode(event.livemode)) {
    return NextResponse.json({ error: "Mode Stripe incompatible." }, { status: 400 });
  }

  try {
    const claim = await claimPaymentEvent({
      providerEventId: event.id,
      eventType: event.type,
      payload: { livemode: event.livemode, created: event.created },
    });
    if (claim === "processed") return NextResponse.json({ received: true, duplicate: true });
    if (claim === "busy") {
      return NextResponse.json(
        { error: "Traitement en cours. Réessayez ultérieurement." },
        { status: 503, headers: { "Retry-After": "60" } },
      );
    }

    let orderId: string | undefined;
    if (
      event.type === "checkout.session.completed" &&
      ["paid", "no_payment_required"].includes(event.data.object.payment_status)
    ) {
      orderId = await fulfillCheckoutSession(event.data.object);
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      orderId = await fulfillCheckoutSession(event.data.object);
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      orderId = await releaseCheckoutSession(event.data.object);
    } else if (event.type === "charge.refunded") {
      orderId = await handleChargeRefunded(event.data.object);
    } else if (
      (event.type === "refund.created" || event.type === "refund.updated") &&
      event.data.object.status === "succeeded"
    ) {
      orderId = await handleSucceededRefund(event.data.object);
    } else if (
      event.type === "refund.failed" ||
      (event.type === "refund.updated" && ["failed", "canceled"].includes(event.data.object.status || ""))
    ) {
      orderId = await handleFailedRefund(event.data.object);
    } else if (event.type === "charge.dispute.created") {
      orderId = await handleDispute(event.data.object);
    }

    await completePaymentEvent(event.id, orderId);
    if (orderId) {
      after(async () => {
        try {
          await processPendingNotifications(10);
        } catch {
          console.error("AVANA post-webhook notification processing failed", { eventId: event.id });
        }
      });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    try {
      await failPaymentEvent(event.id, error instanceof Error ? error.name : "unknown");
    } catch {
      console.error("AVANA Stripe webhook claim could not be released", { eventId: event.id });
    }
    console.error("AVANA Stripe webhook failed", {
      eventId: event.id,
      eventType: event.type,
      category: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Traitement temporairement impossible." }, { status: 500 });
  }
}

import "server-only";

import type Stripe from "stripe";
import { enqueueLowStockAlert, enqueueNotification } from "@/lib/server/notifications";
import { attachOrderInvoice, completeOrderPayment, releaseOrderReservation } from "@/lib/server/orders";
import { getStripe } from "@/lib/server/stripe";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

function expandableId(value: string | { id: string } | null) {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

function shippingAddressFromSession(session: Stripe.Checkout.Session) {
  const shippingDetails = session.collected_information?.shipping_details;
  const customerAddress = session.customer_details?.address;
  if (shippingDetails) return { name: shippingDetails.name, ...shippingDetails.address };
  if (customerAddress) return { name: session.customer_details?.name || "", ...customerAddress };
  return {};
}

export async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) throw new Error("Stripe session is missing order metadata");
  if (session.mode !== "payment" || !["paid", "no_payment_required"].includes(session.payment_status)) {
    throw new Error("Stripe session is not paid");
  }
  if (session.currency?.toLowerCase() !== "cad") throw new Error("Stripe session currency mismatch");
  if (session.client_reference_id !== orderId) {
    throw new Error("Stripe session order reference mismatch");
  }
  const shippingCountry =
    session.collected_information?.shipping_details?.address?.country ||
    session.customer_details?.address?.country;
  if (shippingCountry !== "CA") throw new Error("Stripe shipping country mismatch");
  await completeOrderPayment({
    orderId,
    checkoutSessionId: session.id,
    paymentIntentId: expandableId(session.payment_intent),
    stripeCustomerId: expandableId(session.customer),
    subtotalCents: session.amount_subtotal || 0,
    shippingCents: session.shipping_cost?.amount_total || 0,
    taxCents: session.total_details?.amount_tax || 0,
    totalCents: session.amount_total || 0,
    shippingAddress: shippingAddressFromSession(session),
  });
  const invoiceId = expandableId(session.invoice);
  if (invoiceId) {
    try {
      const invoice = await getStripe().invoices.retrieve(invoiceId);
      await attachOrderInvoice({
        orderId,
        invoiceId,
        invoiceUrl: invoice.hosted_invoice_url || "",
        invoicePdfUrl: invoice.invoice_pdf || "",
      });
    } catch {
      console.error("AVANA invoice attachment deferred", { orderId, invoiceId });
    }
  }
  if (process.env.ORDERS_TO_EMAIL) {
    await enqueueNotification({
      orderId,
      kind: "admin_order_paid",
      recipientEmail: process.env.ORDERS_TO_EMAIL,
      payload: { orderNumber: session.metadata?.orderNumber || "" },
      dedupeKey: `admin-order-paid-${orderId}`,
    });
  }
  await enqueueLowStockAlert();
  return orderId;
}

interface ExpiredOrderRow {
  id: string;
  stripe_checkout_session_id: string | null;
}

function providerCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown";
  return String(error.code);
}

export async function reconcileExpiredCheckoutOrders(limit = 50) {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("id, stripe_checkout_session_id")
    .eq("status", "pending_payment")
    .lt("reservation_expires_at", new Date().toISOString())
    .order("reservation_expires_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Expired checkout lookup failed: ${error.code}`);

  const result = { inspected: 0, fulfilled: 0, released: 0, pending: 0, failed: 0 };
  const orders = (data || []) as ExpiredOrderRow[];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < orders.length) {
      const orderIndex = nextIndex;
      nextIndex += 1;
      const order = orders[orderIndex];
      result.inspected += 1;
      try {
        if (!order.stripe_checkout_session_id) {
          if (await releaseOrderReservation(order.id, "Session de paiement incomplète.")) {
            result.released += 1;
          }
          continue;
        }

        let session = await getStripe().checkout.sessions.retrieve(order.stripe_checkout_session_id);
        if (["paid", "no_payment_required"].includes(session.payment_status)) {
          await fulfillCheckoutSession(session);
          result.fulfilled += 1;
          continue;
        }
        if (session.status === "open") {
          session = await getStripe().checkout.sessions.expire(session.id);
        }
        if (session.status === "expired") {
          if (await releaseOrderReservation(order.id, "Session de paiement expirée.")) {
            result.released += 1;
          }
        } else {
          result.pending += 1;
        }
      } catch (caught) {
        if (providerCode(caught) === "resource_missing") {
          if (await releaseOrderReservation(order.id, "Session Stripe introuvable.")) {
            result.released += 1;
          }
        } else {
          result.failed += 1;
          console.error("AVANA checkout reconciliation failed", { category: providerCode(caught) });
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, orders.length) }, () => worker()));
  return result;
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { checkoutRequestSchema } from "@/lib/validation";
import { absoluteUrl, COMMERCE_ENABLED } from "@/lib/site";
import { commerceSettings, getCommerceReadiness } from "@/lib/server/config";
import { hasValidOrigin } from "@/lib/server/request";
import { readJsonBody, RequestBodyTooLargeError } from "@/lib/server/request-body";
import { attachStripeSession, releaseOrderReservation, reserveCheckoutOrder } from "@/lib/server/orders";
import { rateLimit, requestFingerprint, sensitiveRateLimitIdentifier } from "@/lib/server/rate-limit";
import { getStripe } from "@/lib/server/stripe";

export const runtime = "nodejs";

function checkoutErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("INSUFFICIENT_STOCK"))
    return "Un format vient de devenir indisponible. Vérifiez le panier.";
  if (message.includes("VARIANT_NOT_AVAILABLE")) return "Un produit du panier n’est plus disponible.";
  if (message.includes("INVALID_QUANTITY")) return "Une quantité du panier n’est pas valide.";
  return "Le paiement sécurisé n’a pas pu être démarré. Réessayez dans quelques instants.";
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  }
  if (!COMMERCE_ENABLED) {
    return NextResponse.json({ error: "Le commerce réel n’est pas activé." }, { status: 409 });
  }

  const readiness = getCommerceReadiness();
  if (!readiness.ready) {
    console.error("AVANA checkout configuration incomplete", { missing: readiness.missing });
    return NextResponse.json({ error: "Le paiement est temporairement indisponible." }, { status: 503 });
  }

  if (!(await rateLimit("checkout", requestFingerprint(request), 8, 10 * 60))) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 24_000);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Le panier transmis est trop volumineux." }, { status: 413 });
    }
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vérifiez les informations de la commande.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const customerIdentifier = sensitiveRateLimitIdentifier(parsed.data.contact.email);
  if (!(await rateLimit("checkout-customer", customerIdentifier, 6, 10 * 60))) {
    return NextResponse.json(
      { error: "Trop de tentatives pour cette adresse. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  let reservedOrder: Awaited<ReturnType<typeof reserveCheckoutOrder>> | null = null;
  let stripeSession: Stripe.Checkout.Session | null = null;
  try {
    reservedOrder = await reserveCheckoutOrder(parsed.data);
    const shippingName =
      parsed.data.shippingMethod === "express" ? "Livraison express" : "Livraison standard";
    const minimumDays = parsed.data.shippingMethod === "express" ? 1 : 3;
    const maximumDays = parsed.data.shippingMethod === "express" ? 3 : 6;
    const stripe = getStripe();
    stripeSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        locale: "fr-CA",
        client_reference_id: reservedOrder.id,
        customer_creation: "always",
        customer_email: reservedOrder.email,
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        shipping_address_collection: { allowed_countries: ["CA"] },
        automatic_tax: { enabled: commerceSettings.automaticTax },
        line_items: reservedOrder.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "cad",
            unit_amount: item.unitPriceCents,
            tax_behavior: "exclusive",
            product_data: {
              name: `${item.productName} · ${item.variantLabel}`,
              metadata: { sku: item.sku, lotCode: item.lotCode || "" },
            },
          },
        })),
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: shippingName,
              fixed_amount: { amount: reservedOrder.shippingCents, currency: "cad" },
              delivery_estimate: {
                minimum: { unit: "business_day", value: minimumDays },
                maximum: { unit: "business_day", value: maximumDays },
              },
            },
          },
        ],
        metadata: { orderId: reservedOrder.id, orderNumber: reservedOrder.number },
        payment_intent_data: {
          receipt_email: reservedOrder.email,
          metadata: { orderId: reservedOrder.id, orderNumber: reservedOrder.number },
        },
        invoice_creation: {
          enabled: true,
          invoice_data: { metadata: { orderId: reservedOrder.id, orderNumber: reservedOrder.number } },
        },
        success_url: absoluteUrl(
          `/commande/${encodeURIComponent(reservedOrder.number)}?token=${encodeURIComponent(reservedOrder.accessToken)}&session_id={CHECKOUT_SESSION_ID}`,
        ),
        cancel_url: absoluteUrl("/checkout?annulee=1"),
        submit_type: "pay",
        expires_at: Math.floor(new Date(reservedOrder.reservationExpiresAt).getTime() / 1000),
      },
      { idempotencyKey: `avana-checkout-${reservedOrder.id}` },
    );

    if (!stripeSession.url) throw new Error("Stripe did not return a checkout URL");
    await attachStripeSession(reservedOrder.id, stripeSession.id);
    return NextResponse.json(
      { mode: "live", orderNumber: reservedOrder.number, checkoutUrl: stripeSession.url },
      { status: 201 },
    );
  } catch (error) {
    let stripeSessionClosed = !stripeSession?.id;
    let reservationReleased = false;
    if (stripeSession?.id) {
      try {
        await getStripe().checkout.sessions.expire(stripeSession.id);
        stripeSessionClosed = true;
      } catch {
        console.error("AVANA Stripe session expiration failed", { sessionId: stripeSession.id });
      }
    }
    if (reservedOrder && stripeSessionClosed) {
      try {
        reservationReleased = await releaseOrderReservation(
          reservedOrder.id,
          "La session de paiement n’a pas pu être créée.",
        );
      } catch {
        console.error("AVANA order reservation cleanup failed", { orderId: reservedOrder.id });
      }
    }
    console.error("AVANA checkout session failed", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      {
        error: checkoutErrorMessage(error),
        retryWithNewAttempt: !reservedOrder || reservationReleased,
      },
      { status: 502 },
    );
  }
}

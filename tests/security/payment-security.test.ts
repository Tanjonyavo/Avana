import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { checkoutRequestFingerprint } from "../../lib/checkout-security";
import { createRefundAuthorization, verifyRefundAuthorization } from "../../lib/server/refund-security";
import { stripeEventMatchesConfiguredMode } from "../../lib/server/stripe";
import { createOrderAccessTokenForExpiration, verifyOrderAccessToken } from "../../lib/server/order-access";
import type { CheckoutRequest } from "../../types/commerce";

const checkout: CheckoutRequest = {
  attemptId: "550e8400-e29b-41d4-a716-446655440000",
  contact: {
    email: "Client@Example.ca",
    firstName: "Ava",
    lastName: "Test",
    phone: "",
    marketingConsent: false,
  },
  shippingMethod: "standard",
  cart: [
    { productId: "p2", variantId: "v2", quantity: 2 },
    { productId: "p1", variantId: "v1", quantity: 1 },
  ],
};

describe("payment security", () => {
  const previousStripeKey = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (previousStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousStripeKey;
  });

  it("binds checkout idempotence to a canonical server-side payload", () => {
    const reordered = {
      ...checkout,
      cart: [...checkout.cart].reverse(),
      contact: { ...checkout.contact, email: "client@example.ca" },
    };
    const changed = { ...checkout, cart: [{ ...checkout.cart[0], quantity: 3 }, checkout.cart[1]] };
    expect(checkoutRequestFingerprint(reordered)).toBe(checkoutRequestFingerprint(checkout));
    expect(checkoutRequestFingerprint(changed)).not.toBe(checkoutRequestFingerprint(checkout));
  });

  it("uses a unique checkout attempt and a transaction-scoped advisory lock", () => {
    const sql = readFileSync("supabase/commerce.sql", "utf8");
    expect(sql).toContain("orders_checkout_attempt_id_idx");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("order by item.variant_id");
    expect(sql).toContain("DUPLICATE_VARIANT");
    expect(sql).toContain("CHECKOUT_ATTEMPT_PAYLOAD_MISMATCH");
    expect(sql).toContain("STRIPE_SESSION_ALREADY_ATTACHED");
  });

  it("rejects webhook events from the opposite Stripe mode", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    expect(stripeEventMatchesConfiguredMode(false)).toBe(true);
    expect(stripeEventMatchesConfiguredMode(true)).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    expect(stripeEventMatchesConfiguredMode(true)).toBe(true);
    expect(stripeEventMatchesConfiguredMode(false)).toBe(false);
  });

  it("authenticates restock intent and rejects tampering", () => {
    const input = {
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      paymentIntentId: "pi_test",
      amountCents: 2_500,
      restock: true,
    };
    const authorization = createRefundAuthorization(input, "test-secret");
    expect(verifyRefundAuthorization(input, authorization, "test-secret")).toBe(true);
    expect(verifyRefundAuthorization({ ...input, amountCents: 1 }, authorization, "test-secret")).toBe(false);
    expect(verifyRefundAuthorization(input, authorization, "rotated-secret")).toBe(false);
  });

  it("keeps checkout return tokens stable for the persisted expiration", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
    const expiresAt = Math.floor(Date.now() / 1000) + 3_600;
    const first = await createOrderAccessTokenForExpiration("order-1", "client@example.ca", expiresAt);
    const retry = await createOrderAccessTokenForExpiration("order-1", "client@example.ca", expiresAt);
    expect(first).toBe(retry);
    await expect(verifyOrderAccessToken(first, "order-1", "client@example.ca")).resolves.toBe(true);
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  });

  it("correlates failed sessions and refunds through Stripe identifiers", () => {
    const webhook = readFileSync("app/api/webhooks/stripe/route.ts", "utf8");
    const refund = readFileSync("app/api/admin/orders/[id]/refund/route.ts", "utf8");
    const checkoutRoute = readFileSync("app/api/checkout/session/route.ts", "utf8");
    const orders = readFileSync("lib/server/orders.ts", "utf8");
    expect(webhook).toContain("findOrderByStripeSession(session.id)");
    expect(webhook).toContain("session.client_reference_id !== order.id");
    expect(webhook).not.toContain('event.type === "invoice.finalized"');
    expect(refund).toContain("`avana-refund-${id}-${order.refundedCents}`");
    expect(refund).not.toContain("${order.refundedCents}-${amountCents}");
    expect(checkoutRoute).toContain("reservedOrder.reservationExpiresAt");
    expect(checkoutRoute).toContain("customer_email: reservedOrder.email");
    expect(checkoutRoute).not.toContain("Math.floor(Date.now() / 1000)");
    expect(orders).toContain("left.sku.localeCompare(right.sku)");
  });

  it("reduces the public health probe to one schema query", () => {
    const health = readFileSync("app/api/health/route.ts", "utf8");
    expect(health).toContain('rpc("commerce_schema_version")');
    expect(health).not.toContain('.from("orders")');
    expect(health).not.toContain("Promise.all");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { hasValidOrigin } from "@/lib/server/request";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/admin-auth";

// Synthetic keys only; Stripe's real signature verifier executes without network.
const webhookSecret = "whsec_synthetic_security_regression_only";
const sessionSecret = "synthetic-session-secret-for-security-tests-only";
const stripe = new Stripe("sk_test_synthetic_security_regression_only");

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://avana.example");
  vi.stubEnv("ADMIN_PASSWORD", "synthetic-admin-password");
  vi.stubEnv("ADMIN_TOTP_SECRET", "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  vi.stubEnv("SESSION_SECRET", sessionSecret);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_synthetic_security_regression_only");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", webhookSecret);
});
afterEach(() => vi.unstubAllEnvs());

describe("server authorization boundaries", () => {
  it("rejects missing and forged administrator sessions", async () => {
    const request = new NextRequest("https://avana.example/api/admin/orders/export");
    await expect(isAuthorizedAdminRequest(request)).resolves.toBe(false);
    request.cookies.set(ADMIN_SESSION_COOKIE, "admin.9999999999.AAAAAAAAAAAAAAAAAAAAAA.forged");
    await expect(isAuthorizedAdminRequest(request)).resolves.toBe(false);
  });

  it("requires canonical Origin and registration even with a correctly signed admin token", async () => {
    const token = await createAdminSessionToken(sessionSecret);
    const request = new NextRequest("https://avana.example/api/admin/products", {
      method: "POST",
      headers: { origin: "https://attacker.example", cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
    });
    await expect(isAuthorizedAdminRequest(request, true)).resolves.toBe(false);
    request.headers.set("origin", "https://avana.example");
    expect(hasValidOrigin(request)).toBe(true);
    // The positive case with a persisted session is exercised against real SQL
    // in admin-session.test.ts. A signature alone must now be insufficient.
    await expect(isAuthorizedAdminRequest(request, true)).resolves.toBe(false);
  });

  it("rejects missing, opaque and forged same-origin headers in production", () => {
    for (const origin of [null, "null", "https://avana.example.attacker.example", "https://evil.example"]) {
      const request = new NextRequest("https://internal-proxy.example/api/submissions", {
        headers: origin === null ? {} : { origin, "x-forwarded-host": "avana.example" },
      });
      expect(hasValidOrigin(request)).toBe(false);
    }
  });
});

describe("Stripe webhook cryptographic boundary", () => {
  function request(body: string, signature?: string) {
    return new NextRequest("https://avana.example/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: signature ? { "stripe-signature": signature } : {},
    });
  }

  it("rejects unsigned events before persistence", async () => {
    const response = await stripeWebhook(request('{"type":"checkout.session.completed"}'));
    expect(response.status).toBe(400);
  });

  it("rejects altered payloads despite an authentic signature for the original bytes", async () => {
    const body = JSON.stringify({ id: "evt_synthetic", livemode: false, data: { object: {} } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: webhookSecret });
    expect((await stripeWebhook(request(`${body} `, signature))).status).toBe(400);
  });

  it("rejects replay outside Stripe's timestamp tolerance", async () => {
    const body = JSON.stringify({ id: "evt_synthetic", livemode: false, data: { object: {} } });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: webhookSecret,
      timestamp: Math.floor(Date.now() / 1000) - 600,
    });
    expect((await stripeWebhook(request(body, signature))).status).toBe(400);
  });

  it("rejects a correctly signed event from the opposite live/test mode", async () => {
    const body = JSON.stringify({ id: "evt_synthetic", livemode: true, data: { object: {} } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: webhookSecret });
    const response = await stripeWebhook(request(body, signature));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Mode Stripe incompatible." });
  });
});

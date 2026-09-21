import "server-only";
import Stripe from "stripe";
import { isStripeConfigured } from "@/lib/server/config";

let stripeClient: Stripe | null = null;

export function stripeEventMatchesConfiguredMode(livemode: boolean) {
  const key = process.env.STRIPE_SECRET_KEY || "";
  return livemode ? key.startsWith("sk_live_") : key.startsWith("sk_test_");
}

export function getStripe() {
  if (!isStripeConfigured()) throw new Error("Stripe configuration is incomplete");
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      appInfo: { name: "AVANA Web", version: "1.0.0" },
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }
  return stripeClient;
}

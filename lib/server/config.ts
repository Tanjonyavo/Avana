import "server-only";
import { canonicalSiteOrigin } from "@/lib/site";

function readPositiveInteger(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function isSupabaseAdminConfigured() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function isSupabaseAuthConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function getCommerceReadiness() {
  const missing: string[] = [];
  if (!isSupabaseAdminConfigured()) missing.push("Supabase serveur");
  if (!isSupabaseAuthConfigured()) missing.push("Supabase Auth");
  if (!isStripeConfigured()) missing.push("Stripe");
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 14)
    missing.push("ADMIN_PASSWORD robuste");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    missing.push("SESSION_SECRET");
  }
  if (!process.env.ADMIN_TOTP_SECRET || !/^[A-Z2-7]{32,}$/i.test(process.env.ADMIN_TOTP_SECRET)) {
    missing.push("ADMIN_TOTP_SECRET");
  }
  if (!isEmailConfigured()) missing.push("Resend");
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) missing.push("CRON_SECRET");
  if (!process.env.ORDERS_TO_EMAIL) missing.push("ORDERS_TO_EMAIL");
  if (
    !process.env.BUSINESS_NAME ||
    !process.env.BUSINESS_SUPPORT_EMAIL ||
    !process.env.BUSINESS_ADDRESS_LINE1 ||
    !process.env.BUSINESS_CITY ||
    !process.env.BUSINESS_POSTAL_CODE
  ) {
    missing.push("coordonnées commerciales");
  }
  if (
    process.env.NODE_ENV === "production" &&
    !canonicalSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL || "", true)
  ) {
    missing.push("NEXT_PUBLIC_SITE_URL HTTPS");
  }
  return { ready: missing.length === 0, missing };
}

export const commerceSettings = {
  standardShippingCents: readPositiveInteger("STANDARD_SHIPPING_CENTS", 800),
  expressShippingCents: readPositiveInteger("EXPRESS_SHIPPING_CENTS", 1600),
  freeShippingThresholdCents: readPositiveInteger("FREE_SHIPPING_THRESHOLD_CENTS", 6000),
  reservationMinutes: Math.max(30, Math.min(readPositiveInteger("ORDER_RESERVATION_MINUTES", 30), 120)),
  reservationGraceMinutes: 10,
  lowStockThreshold: Math.min(readPositiveInteger("LOW_STOCK_THRESHOLD", 5), 1_000_000),
  automaticTax: process.env.STRIPE_AUTOMATIC_TAX !== "false",
  business: {
    name: process.env.BUSINESS_NAME || "AVANA",
    supportEmail: process.env.BUSINESS_SUPPORT_EMAIL || process.env.CONTACT_TO_EMAIL || "",
    phone: process.env.BUSINESS_PHONE || "",
    addressLine1: process.env.BUSINESS_ADDRESS_LINE1 || "",
    addressLine2: process.env.BUSINESS_ADDRESS_LINE2 || "",
    city: process.env.BUSINESS_CITY || "",
    province: process.env.BUSINESS_PROVINCE || "QC",
    postalCode: process.env.BUSINESS_POSTAL_CODE || "",
    country: process.env.BUSINESS_COUNTRY || "CA",
  },
} as const;

export function shippingPriceCents(method: "standard" | "express", subtotalCents: number) {
  if (method === "standard" && subtotalCents >= commerceSettings.freeShippingThresholdCents) return 0;
  return method === "express"
    ? commerceSettings.expressShippingCents
    : commerceSettings.standardShippingCents;
}

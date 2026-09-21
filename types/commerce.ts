import type { Lot, Product } from "@/types";

export type ShippingMethod = "standard" | "express";
export type OrderStatus = "pending_payment" | "paid" | "processing" | "fulfilled" | "cancelled" | "refunded";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
export type FulfillmentStatus = "unfulfilled" | "processing" | "shipped" | "delivered" | "returned";

export interface CheckoutContactInput {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  marketingConsent: boolean;
}

export interface CheckoutCartInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CheckoutRequest {
  attemptId: string;
  contact: CheckoutContactInput;
  cart: CheckoutCartInput[];
  shippingMethod: ShippingMethod;
}

export interface CheckoutResponse {
  mode: "live";
  orderNumber: string;
  checkoutUrl: string;
}

export interface PublicOrderItem {
  productName: string;
  variantLabel: string;
  sku: string;
  lotCode: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface PublicOrderEvent {
  status: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PublicShipment {
  carrier: string;
  service: string | null;
  trackingNumber: string;
  trackingUrl: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface PublicOrder {
  number: string;
  customerName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  shippingMethod: ShippingMethod;
  currency: "CAD";
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  refundedCents: number;
  createdAt: string;
  paidAt: string | null;
  invoiceUrl: string | null;
  invoicePdfUrl: string | null;
  items: PublicOrderItem[];
  events: PublicOrderEvent[];
  shipments: PublicShipment[];
}

export interface AdminOrder extends PublicOrder {
  id: string;
  email: string;
  phone: string | null;
  shippingAddress: Record<string, unknown> | null;
  stripePaymentIntentId: string | null;
  marketingConsent: boolean;
}

export interface CatalogSnapshot {
  products: Product[];
  mode: "demo" | "live" | "unconfigured";
  message?: string;
}

export interface AdminProductVariant {
  id: string;
  label: string;
  sku: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stockOnHand: number;
  stockReserved: number;
  weightGrams: number;
  active: boolean;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  category: string;
  image: string;
  origin: string;
  region: string;
  species: string;
  lotCode: string;
  status: "available" | "waitlist" | "development";
  featured: boolean;
  active: boolean;
  dataStatus: string;
  audience: Array<"B2C" | "Professionnels">;
  uses: string[];
  storage: string;
  composition: string;
  variants: AdminProductVariant[];
}

export interface LotSnapshot {
  lots: Lot[];
  mode: "demo" | "live" | "unconfigured";
  message?: string;
}

export interface AnalyticsDailyPoint {
  date: string;
  pageViews: number;
  productViews: number;
  cartAdds: number;
  checkouts: number;
  purchases: number;
}

export interface AdminAnalyticsData {
  last7Days: Record<string, number>;
  last30Days: Record<string, number>;
  daily: AnalyticsDailyPoint[];
  topPaths: Array<{ path: string; views: number }>;
}

export interface AdminMarketingCampaign {
  id: string;
  subject: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface AdminMarketingData {
  subscribed: number;
  pending: number;
  unsubscribed: number;
  campaigns: AdminMarketingCampaign[];
}

export interface AdminCustomer {
  email: string;
  name: string;
  orderCount: number;
  paidCents: number;
  lastOrderAt: string;
  marketingConsent: boolean;
}

export type InventoryAdjustmentReason = "receipt" | "loss" | "correction_add" | "correction_remove";

export interface InventorySummary {
  variantId: string;
  soldUnits: number;
  lossUnits: number;
}

export interface InventoryMovement {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  variantLabel: string;
  quantityDelta: number;
  reason: string;
  note: string;
  actor: string;
  createdAt: string;
}

export interface CustomerProfile {
  displayName: string;
  phone: string;
  marketingConsent: boolean;
}

export interface CustomerAddress {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: "CA";
  isDefault: boolean;
}

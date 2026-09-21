import "server-only";
import { revalidatePath } from "next/cache";
import { checkoutRequestFingerprint } from "@/lib/checkout-security";
import { commerceSettings } from "@/lib/server/config";
import {
  createOrderAccessToken,
  createOrderAccessTokenForExpiration,
  verifyOrderAccessToken,
} from "@/lib/server/order-access";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { isSafeHttpsUrl } from "@/lib/security";
import type {
  AdminOrder,
  CheckoutRequest,
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  PublicOrder,
  PublicOrderEvent,
  PublicOrderItem,
  PublicShipment,
  ShippingMethod,
  AdminCustomer,
} from "@/types/commerce";

interface OrderItemRow {
  product_name: string;
  variant_label: string;
  sku: string;
  lot_code: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

interface OrderEventRow {
  status: string;
  message: string;
  metadata: Record<string, unknown> | null;
  public: boolean;
  created_at: string;
}

interface ShipmentRow {
  carrier: string;
  service: string | null;
  tracking_number: string;
  tracking_url: string | null;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
}

interface OrderRow {
  id: string;
  number: string;
  customer_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  shipping_address: Record<string, unknown> | null;
  shipping_method: ShippingMethod;
  currency: "CAD";
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  refunded_cents: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  stripe_invoice_id: string | null;
  invoice_url: string | null;
  invoice_pdf_url: string | null;
  marketing_consent: boolean;
  reservation_expires_at: string | null;
  created_at: string;
  paid_at: string | null;
  order_items: OrderItemRow[];
  order_status_events: OrderEventRow[];
  shipments: ShipmentRow[];
}

export interface ReservedOrder {
  id: string;
  number: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  items: PublicOrderItem[];
  accessToken: string;
  reservationExpiresAt: string;
  email: string;
}

const orderSelection = "*, order_items(*), order_status_events(*), shipments(*)";

function mapItems(rows: OrderItemRow[]): PublicOrderItem[] {
  return rows
    .map((row) => ({
      productName: row.product_name,
      variantLabel: row.variant_label,
      sku: row.sku,
      lotCode: row.lot_code,
      quantity: row.quantity,
      unitPriceCents: row.unit_price_cents,
      lineTotalCents: row.line_total_cents,
    }))
    .sort((left, right) => left.sku.localeCompare(right.sku));
}

function mapEvents(rows: OrderEventRow[]): PublicOrderEvent[] {
  return rows
    .filter((row) => row.public)
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .map((row) => ({
      status: row.status,
      message: row.message,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));
}

function mapShipments(rows: ShipmentRow[]): PublicShipment[] {
  return rows.map((row) => ({
    carrier: row.carrier,
    service: row.service,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url && isSafeHttpsUrl(row.tracking_url) ? row.tracking_url : null,
    status: row.status,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
  }));
}

function mapPublicOrder(row: OrderRow): PublicOrder {
  return {
    number: row.number,
    customerName: `${row.first_name} ${row.last_name}`.trim(),
    status: row.status,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    shippingMethod: row.shipping_method,
    currency: row.currency,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    discountCents: row.discount_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    refundedCents: row.refunded_cents,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    invoiceUrl: row.invoice_url && isSafeHttpsUrl(row.invoice_url) ? row.invoice_url : null,
    invoicePdfUrl: row.invoice_pdf_url && isSafeHttpsUrl(row.invoice_pdf_url) ? row.invoice_pdf_url : null,
    items: mapItems(row.order_items || []),
    events: mapEvents(row.order_status_events || []),
    shipments: mapShipments(row.shipments || []),
  };
}

function mapAdminOrder(row: OrderRow): AdminOrder {
  return {
    ...mapPublicOrder(row),
    id: row.id,
    email: row.email,
    phone: row.phone,
    shippingAddress: row.shipping_address,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    marketingConsent: row.marketing_consent,
  };
}

async function fetchOrderBy(column: "id" | "number", value: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(orderSelection)
    .eq(column, value)
    .maybeSingle();
  if (error) throw new Error(`Order lookup failed: ${error.code}`);
  return data as OrderRow | null;
}

export async function reserveCheckoutOrder(request: CheckoutRequest): Promise<ReservedOrder> {
  const { data, error } = await getSupabaseAdmin().rpc("reserve_order", {
    checkout_attempt_id_value: request.attemptId,
    checkout_request_hash_value: checkoutRequestFingerprint(request),
    customer_data: request.contact,
    shipping_method_value: request.shippingMethod,
    requested_items: request.cart.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
    standard_shipping_cents: commerceSettings.standardShippingCents,
    express_shipping_cents: commerceSettings.expressShippingCents,
    free_shipping_threshold_cents: commerceSettings.freeShippingThresholdCents,
    reservation_minutes: commerceSettings.reservationMinutes + commerceSettings.reservationGraceMinutes,
  });
  if (error) throw new Error(`Order reservation failed: ${error.message}`);

  const reservation = data as {
    id: string;
    number: string;
    subtotalCents: number;
    shippingCents: number;
    totalCents: number;
  };
  const order = await fetchOrderBy("id", reservation.id);
  if (!order) throw new Error("Reserved order could not be loaded");
  if (!order.reservation_expires_at) throw new Error("Reserved order is missing its expiration");
  revalidatePath("/", "layout");
  const checkoutAccessExpiration =
    Math.floor(new Date(order.created_at).getTime() / 1000) + 60 * 60 * 24 * 30;
  return {
    ...reservation,
    items: mapItems(order.order_items || []),
    accessToken: await createOrderAccessTokenForExpiration(order.id, order.email, checkoutAccessExpiration),
    reservationExpiresAt: order.reservation_expires_at,
    email: order.email,
  };
}

export async function attachStripeSession(orderId: string, sessionId: string) {
  const { error } = await getSupabaseAdmin().rpc("attach_stripe_session", {
    order_id_value: orderId,
    session_id_value: sessionId,
  });
  if (error) throw new Error(`Stripe session could not be attached: ${error.code}`);
}

export async function releaseOrderReservation(orderId: string, reason?: string) {
  const { data, error } = await getSupabaseAdmin().rpc("release_order_reservation", {
    order_id_value: orderId,
    cancellation_reason: reason || "Paiement non complété.",
  });
  if (error) throw new Error(`Order reservation could not be released: ${error.code}`);
  if (data === true) revalidatePath("/", "layout");
  return data === true;
}

export async function completeOrderPayment(input: {
  orderId: string;
  checkoutSessionId: string;
  paymentIntentId: string;
  stripeCustomerId: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shippingAddress: Record<string, unknown>;
}) {
  const { data, error } = await getSupabaseAdmin().rpc("complete_order_payment", {
    order_id_value: input.orderId,
    checkout_session_id_value: input.checkoutSessionId,
    payment_intent_id_value: input.paymentIntentId,
    stripe_customer_id_value: input.stripeCustomerId,
    subtotal_cents_value: input.subtotalCents,
    shipping_cents_value: input.shippingCents,
    tax_cents_value: input.taxCents,
    total_cents_value: input.totalCents,
    shipping_address_value: input.shippingAddress,
  });
  if (error) throw new Error(`Order payment could not be completed: ${error.message}`);
  if (data === true) revalidatePath("/", "layout");
  return data === true;
}

export async function attachOrderInvoice(input: {
  orderId: string;
  invoiceId: string;
  invoiceUrl: string;
  invoicePdfUrl: string;
}) {
  const { error } = await getSupabaseAdmin()
    .from("orders")
    .update({
      stripe_invoice_id: input.invoiceId,
      invoice_url: input.invoiceUrl || null,
      invoice_pdf_url: input.invoicePdfUrl || null,
    })
    .eq("id", input.orderId);
  if (error) throw new Error(`Invoice could not be attached: ${error.code}`);
}

export async function listLowStockVariants(threshold = 5) {
  const { data, error } = await getSupabaseAdmin()
    .from("product_variants")
    .select("id, sku, label, stock_on_hand, stock_reserved, products(name)")
    .eq("active", true)
    .limit(500);
  if (error) throw new Error(`Low stock could not be checked: ${error.code}`);
  return (data || []).flatMap((row) => {
    const available = Number(row.stock_on_hand) - Number(row.stock_reserved);
    if (available > threshold) return [];
    const relation = row.products as unknown as { name?: string } | Array<{ name?: string }> | null;
    const productName = Array.isArray(relation) ? relation[0]?.name : relation?.name;
    return [{ id: row.id, sku: row.sku, label: row.label, productName: productName || "Produit", available }];
  });
}

export async function findOrderByStripeSession(sessionId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(orderSelection)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`Stripe order lookup failed: ${error.code}`);
  return data ? mapAdminOrder(data as OrderRow) : null;
}

export async function findOrderByPaymentIntent(paymentIntentId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(orderSelection)
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) throw new Error(`Payment intent order lookup failed: ${error.code}`);
  return data ? mapAdminOrder(data as OrderRow) : null;
}

export async function getPublicOrderByAccess(number: string, token: string) {
  const order = await fetchOrderBy("number", number);
  if (!order || !(await verifyOrderAccessToken(token, order.id, order.email))) return null;
  return mapPublicOrder(order);
}

export async function getPublicOrderForCustomer(number: string, userId: string) {
  const order = await fetchOrderBy("number", number);
  if (!order || order.customer_id !== userId) return null;
  return mapPublicOrder(order);
}

export async function getOrderAccessLinkData(orderId: string) {
  const order = await fetchOrderBy("id", orderId);
  if (!order) return null;
  return {
    order: mapAdminOrder(order),
    accessToken: await createOrderAccessToken(order.id, order.email),
  };
}

export async function findOrderForAccessRequest(number: string, email: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("id, number, email")
    .eq("number", number)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Order access request failed: ${error.code}`);
  return data as { id: string; number: string; email: string } | null;
}

export async function listAdminOrders(limit = 100) {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(orderSelection)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 250)));
  if (error) throw new Error(`Orders could not be listed: ${error.code}`);
  return (data as OrderRow[]).map(mapAdminOrder);
}

export async function listAdminCustomers(): Promise<AdminCustomer[]> {
  const { data, error } = await getSupabaseAdmin().rpc("admin_customer_summary");
  if (error) throw new Error(`Customers could not be listed: ${error.code}`);
  return (
    (data || []) as Array<{
      email: string;
      customer_name: string;
      order_count: number | string;
      paid_cents: number | string;
      last_order_at: string;
      marketing_consent: boolean;
    }>
  ).map((row) => ({
    email: row.email,
    name: row.customer_name,
    orderCount: Number(row.order_count),
    paidCents: Number(row.paid_cents),
    lastOrderAt: row.last_order_at,
    marketingConsent: row.marketing_consent,
  }));
}

export async function getAdminOrderById(orderId: string) {
  const order = await fetchOrderBy("id", orderId);
  return order ? mapAdminOrder(order) : null;
}

export async function recordAuditLog(input: {
  actor?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await getSupabaseAdmin()
    .from("audit_logs")
    .insert({
      actor: input.actor || "admin-session",
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      metadata: input.metadata || {},
    });
  if (error) throw new Error(`Audit log could not be recorded: ${error.code}`);
}

export async function listCustomerOrders(userId: string, email: string) {
  await getSupabaseAdmin()
    .from("orders")
    .update({ customer_id: userId })
    .is("customer_id", null)
    .eq("email", email.trim().toLowerCase());
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(orderSelection)
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Customer orders could not be listed: ${error.code}`);
  return (data as OrderRow[]).map(mapPublicOrder);
}

export async function claimPaymentEvent(input: {
  providerEventId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<"claimed" | "processed" | "busy"> {
  const client = getSupabaseAdmin();
  const { data, error } = await client.rpc("claim_payment_event", {
    provider_event_id_value: input.providerEventId,
    event_type_value: input.eventType,
    payload_value: input.payload || {},
  });
  if (error) throw new Error(`Payment event could not be claimed: ${error.code}`);
  if (data === true) return "claimed";

  const { data: existing, error: lookupError } = await client
    .from("payment_events")
    .select("status")
    .eq("provider_event_id", input.providerEventId)
    .maybeSingle();
  if (lookupError) throw new Error(`Payment event status could not be read: ${lookupError.code}`);
  // A processing lease may belong to a worker that crashed. Acknowledge only
  // completed work, so Stripe keeps retrying until that lease can be reclaimed.
  return existing?.status === "processed" ? "processed" : "busy";
}

export async function completePaymentEvent(providerEventId: string, orderId?: string) {
  const { data, error } = await getSupabaseAdmin().rpc("complete_payment_event", {
    provider_event_id_value: providerEventId,
    order_id_value: orderId || null,
  });
  if (error || data !== true)
    throw new Error(`Payment event could not be completed: ${error?.code || "state"}`);
}

export async function failPaymentEvent(providerEventId: string, errorCode: string) {
  const { error } = await getSupabaseAdmin().rpc("fail_payment_event", {
    provider_event_id_value: providerEventId,
    error_code_value: errorCode,
  });
  if (error) throw new Error(`Payment event could not be failed: ${error.code}`);
}

export async function markOrderShipped(input: {
  orderId: string;
  carrier: string;
  service: string;
  trackingNumber: string;
  trackingUrl: string;
}) {
  const { error } = await getSupabaseAdmin().rpc("mark_order_shipped", {
    order_id_value: input.orderId,
    carrier_value: input.carrier,
    service_value: input.service,
    tracking_number_value: input.trackingNumber,
    tracking_url_value: input.trackingUrl,
  });
  if (error) throw new Error(`Order could not be marked as shipped: ${error.message}`);
}

export async function markOrderProcessing(orderId: string) {
  const { data, error } = await getSupabaseAdmin().rpc("mark_order_processing", {
    order_id_value: orderId,
  });
  if (error) throw new Error(`Order could not be marked as processing: ${error.message}`);
  return data === true;
}

export async function markOrderDelivered(orderId: string) {
  const { data, error } = await getSupabaseAdmin().rpc("mark_order_delivered", {
    order_id_value: orderId,
  });
  if (error) throw new Error(`Order could not be marked as delivered: ${error.message}`);
  return data === true;
}

export async function markOrderRefunded(orderId: string, restock: boolean) {
  const { data, error } = await getSupabaseAdmin().rpc("mark_order_refunded", {
    order_id_value: orderId,
    restock_items: restock,
  });
  if (error) throw new Error(`Order could not be marked as refunded: ${error.message}`);
  if (data === true && restock) revalidatePath("/", "layout");
  return data === true;
}

export async function markOrderPartiallyRefunded(orderId: string, refundedCents: number) {
  const { data, error } = await getSupabaseAdmin().rpc("mark_order_partially_refunded", {
    order_id_value: orderId,
    refunded_cents_value: refundedCents,
  });
  if (error) throw new Error(`Order refund could not be synchronized: ${error.message}`);
  return data === true;
}

export async function releaseExpiredOrders() {
  const { data, error } = await getSupabaseAdmin().rpc("release_expired_orders");
  if (error) throw new Error(`Expired orders could not be released: ${error.code}`);
  return Number(data || 0);
}

export async function listTrackableCanadaPostShipments() {
  const { data, error } = await getSupabaseAdmin()
    .from("shipments")
    .select("id, order_id, tracking_number, status")
    .ilike("carrier", "%Canada Post%")
    .in("status", ["label_created", "in_transit", "out_for_delivery", "exception"])
    .limit(50);
  if (error) throw new Error(`Shipments could not be listed: ${error.code}`);
  return data as Array<{ id: string; order_id: string; tracking_number: string; status: string }>;
}

export async function updateShipmentStatus(input: {
  shipmentId: string;
  status: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await getSupabaseAdmin().rpc("update_shipment_status", {
    shipment_id_value: input.shipmentId,
    status_value: input.status,
    message_value: input.message,
    metadata_value: input.metadata || {},
  });
  if (error) throw new Error(`Shipment status could not be updated: ${error.message}`);
  return data === true;
}

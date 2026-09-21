import { describe, expect, it } from "vitest";
import {
  adminInventoryAdjustmentSchema,
  adminCampaignSchema,
  adminOperationalRecordSchema,
  adminRefundSchema,
  adminShipmentSchema,
  adminVariantCreateSchema,
  analyticsEventSchema,
  checkoutAddressSchema,
  checkoutContactSchema,
  checkoutRequestSchema,
  customerAddressSchema,
  customerProfileSchema,
  storedOrderSchema,
  submissionSchema,
} from "../lib/validation";
import { formatDate } from "../lib/utils";

describe("validation boundaries", () => {
  it("rejects malformed checkout details", () => {
    expect(
      checkoutContactSchema.safeParse({ email: "bad", firstName: "", lastName: "Test", phone: "" }).success,
    ).toBe(false);
    expect(
      checkoutAddressSchema.safeParse({
        address: "1 rue Test",
        apartment: "",
        city: "Montréal",
        province: "QC",
        postal: "123",
      }).success,
    ).toBe(false);
  });

  it("does not retain undeclared payment fields in stored orders", () => {
    const order = storedOrderSchema.parse({
      number: "AVA-ORD-2026-000001",
      createdAt: "2026-09-09T12:00:00.000Z",
      status: "Confirmée",
      items: [],
      shipping: "standard",
      subtotal: 0,
      shippingPrice: 0,
      tax: 0,
      total: 0,
      demo: true,
      card: "4242424242424242",
      cvc: "123",
    });
    expect(order).not.toHaveProperty("card");
    expect(order).not.toHaveProperty("cvc");
  });

  it("drops client-supplied prices, totals and roles", () => {
    const checkout = checkoutRequestSchema.parse({
      attemptId: "018f47ca-0d9f-7a5d-9b6a-4b7891234567",
      contact: {
        email: "ava@example.ca",
        firstName: "Ava",
        lastName: "Test",
        phone: "",
        marketingConsent: false,
      },
      cart: [{ productId: "product", variantId: "variant", quantity: 1, priceCents: 1 }],
      shippingMethod: "standard",
      totalCents: 1,
    });
    expect(checkout).not.toHaveProperty("totalCents");
    expect(checkout.cart[0]).not.toHaveProperty("priceCents");

    const profile = customerProfileSchema.parse({
      displayName: "Ava",
      phone: "",
      marketingConsent: false,
      role: "admin",
    });
    expect(profile).not.toHaveProperty("role");
  });

  it("requires explicit consent for contact submissions", () => {
    const result = submissionSchema.safeParse({
      kind: "contact",
      name: "Ava Test",
      email: "ava@example.ca",
      requestType: "Autre",
      subject: "Question",
      message: "Bonjour",
      consent: false,
      _gotcha: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a comparison price below the current price", () => {
    const result = adminVariantCreateSchema.safeParse({
      label: "25 g",
      sku: "VAN-25",
      priceCents: 2500,
      compareAtPriceCents: 2000,
      stockOnHand: 10,
      weightGrams: 25,
      active: true,
    });
    expect(result.success).toBe(false);
  });

  it("validates inventory adjustments and Canadian addresses", () => {
    expect(
      adminInventoryAdjustmentSchema.safeParse({
        variantId: "variant-1",
        reason: "receipt",
        quantity: 12,
        note: "Réception contrôlée",
      }).success,
    ).toBe(true);
    expect(
      customerAddressSchema.safeParse({
        label: "Maison",
        firstName: "Ava",
        lastName: "Test",
        addressLine1: "1 rue Test",
        addressLine2: "",
        city: "Montréal",
        province: "QC",
        postalCode: "H2X 1Y4",
        country: "CA",
        isDefault: true,
      }).success,
    ).toBe(true);
  });

  it("limits operational payloads and analytics events", () => {
    const oversizedData = Object.fromEntries(
      Array.from({ length: 41 }, (_, index) => [`field-${index}`, "value"]),
    );
    expect(
      adminOperationalRecordSchema.safeParse({ title: "Dossier", status: "Brouillon", data: oversizedData })
        .success,
    ).toBe(false);
    expect(
      analyticsEventSchema.safeParse({
        eventName: "purchase",
        anonymousId: "anonymous-session-123456",
        path: "/commande/AVA-2026-000001",
        properties: { total: 45 },
      }).success,
    ).toBe(true);
  });

  it("requires a positive whole-cent refund amount", () => {
    expect(adminRefundSchema.safeParse({ restock: false, amountCents: 1250 }).success).toBe(true);
    expect(adminRefundSchema.safeParse({ restock: false, amountCents: 12.5 }).success).toBe(false);
    expect(adminRefundSchema.safeParse({ restock: false, amountCents: 0 }).success).toBe(false);
  });

  it("allows only HTTPS for stored external links", () => {
    expect(
      adminShipmentSchema.safeParse({
        carrier: "Postes Canada",
        service: "Expedited",
        trackingNumber: "123",
        trackingUrl: "https://www.canadapost-postescanada.ca/track-reperage/fr",
      }).success,
    ).toBe(true);
    expect(
      adminShipmentSchema.safeParse({
        carrier: "Test",
        service: "",
        trackingNumber: "123",
        trackingUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      adminCampaignSchema.safeParse({
        subject: "Nouvelles",
        preheader: "",
        heading: "AVANA",
        body: "Bonjour",
        actionLabel: "Voir",
        actionUrl: "http://example.com",
        confirmed: true,
      }).success,
    ).toBe(false);
  });

  it("keeps date-only values on their calendar day", () => {
    expect(formatDate("2027-01-01")).toContain("2027");
  });
});

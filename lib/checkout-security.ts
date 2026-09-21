import "server-only";
import { createHash } from "node:crypto";
import type { CheckoutRequest } from "@/types/commerce";

export function checkoutRequestFingerprint(request: CheckoutRequest) {
  const canonicalRequest = {
    contact: {
      email: request.contact.email.trim().toLowerCase(),
      firstName: request.contact.firstName.trim(),
      lastName: request.contact.lastName.trim(),
      phone: request.contact.phone.trim(),
      marketingConsent: request.contact.marketingConsent,
    },
    shippingMethod: request.shippingMethod,
    cart: request.cart
      .map((item) => ({ variantId: item.variantId, quantity: item.quantity }))
      .sort((left, right) => left.variantId.localeCompare(right.variantId)),
  };
  return createHash("sha256").update(JSON.stringify(canonicalRequest)).digest("hex");
}

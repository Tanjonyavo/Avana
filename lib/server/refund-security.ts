import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

interface RefundAuthorizationInput {
  orderId: string;
  paymentIntentId: string;
  amountCents: number;
  restock: boolean;
}

function refundAuthorizationPayload(input: RefundAuthorizationInput) {
  return `${input.orderId}\u0000${input.paymentIntentId}\u0000${input.amountCents}\u0000${input.restock}`;
}

export function createRefundAuthorization(input: RefundAuthorizationInput, secret: string) {
  return createHmac("sha256", secret).update(refundAuthorizationPayload(input)).digest("base64url");
}

export function verifyRefundAuthorization(
  input: RefundAuthorizationInput,
  authorization: string | undefined,
  secret: string,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(authorization || "")) return false;
  const expected = Buffer.from(createRefundAuthorization(input, secret));
  const received = Buffer.from(authorization || "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

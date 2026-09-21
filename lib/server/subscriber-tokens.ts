import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";

export function createSubscriberToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashSubscriberToken(token) };
}

export function hashSubscriberToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createUnsubscribeToken(email: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET is required for unsubscribe tokens");
  const token = createHmac("sha256", secret)
    .update(`newsletter-unsubscribe\u0000${email.trim().toLowerCase()}`)
    .digest("base64url");
  return { token, hash: hashSubscriberToken(token) };
}

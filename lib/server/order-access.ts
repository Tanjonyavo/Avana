import "server-only";

const encoder = new TextEncoder();
const DEFAULT_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return value;
}

export async function createOrderAccessTokenForExpiration(orderId: string, email: string, expiresAt: number) {
  const payload = `${orderId}.${email.trim().toLowerCase()}.${expiresAt}`;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret()), encoder.encode(payload));
  return `v1.${expiresAt}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function createOrderAccessToken(
  orderId: string,
  email: string,
  lifetime = DEFAULT_LIFETIME_SECONDS,
) {
  return createOrderAccessTokenForExpiration(orderId, email, Math.floor(Date.now() / 1000) + lifetime);
}

export async function verifyOrderAccessToken(token: string, orderId: string, email: string) {
  const [version, expiresAtValue, signatureValue] = token.split(".");
  const expiresAt = Number(expiresAtValue);
  if (version !== "v1" || !Number.isFinite(expiresAt) || expiresAt <= Date.now() / 1000 || !signatureValue) {
    return false;
  }
  try {
    const payload = `${orderId}.${email.trim().toLowerCase()}.${expiresAt}`;
    return crypto.subtle.verify(
      "HMAC",
      await signingKey(secret()),
      Buffer.from(signatureValue, "base64url"),
      encoder.encode(payload),
    );
  } catch {
    return false;
  }
}

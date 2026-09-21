export const ADMIN_SESSION_COOKIE = "avana_admin_session";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 2;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(secret: string) {
  const credentials = `${secret}\u0000${process.env.ADMIN_PASSWORD || ""}\u0000${process.env.ADMIN_TOTP_SECRET || ""}`;
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(credentials),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.toUpperCase().replace(/[=\s-]/g, "");
  if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) return null;
  let bits = "";
  for (const character of normalized) bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2);
  }
  return bytes;
}

export function isAdminAuthConfigured() {
  const baseConfigured = Boolean(
    process.env.ADMIN_PASSWORD &&
      process.env.ADMIN_PASSWORD.length >= 14 &&
      process.env.SESSION_SECRET &&
      process.env.SESSION_SECRET.length >= 32,
  );
  if (!baseConfigured) return false;
  if (process.env.NODE_ENV !== "production") return true;
  const totpSecret = process.env.ADMIN_TOTP_SECRET;
  if (!totpSecret) return false;
  return (decodeBase32(totpSecret)?.length || 0) >= 20;
}

export async function createAdminSessionToken(secret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS;
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `admin.${expiresAt}.${nonce}`;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminSessionToken(token: string | undefined, secret: string | undefined) {
  if (!token || !secret) return false;
  const [role, expiresAt, nonce, signature, extra] = token.split(".");
  if (
    role !== "admin" ||
    !/^\d{10}$/.test(expiresAt || "") ||
    !/^[A-Za-z0-9_-]{22}$/.test(nonce || "") ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature || "") ||
    extra ||
    Number(expiresAt) <= Date.now() / 1000
  )
    return false;

  try {
    return crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      fromBase64Url(signature),
      encoder.encode(`${role}.${expiresAt}.${nonce}`),
    );
  } catch {
    return false;
  }
}

export async function verifyTotp(code: string, secret: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const keyBytes = decodeBase32(secret);
  if (!keyBytes || keyBytes.length < 20) return false;
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, [
    "sign",
  ]);
  const currentCounter = Math.floor(now / 30_000);

  for (const offset of [-1, 0, 1]) {
    const counter = new ArrayBuffer(8);
    new DataView(counter).setBigUint64(0, BigInt(currentCounter + offset));
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
    const position = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[position] & 0x7f) << 24) |
      ((digest[position + 1] & 0xff) << 16) |
      ((digest[position + 2] & 0xff) << 8) |
      (digest[position + 3] & 0xff);
    if (String(binary % 1_000_000).padStart(6, "0") === code) return true;
  }
  return false;
}

export async function createAdminOtpReplayIdentifier(code: string, secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${secret}\u0000${code}`));
  return toBase64Url(new Uint8Array(digest));
}

export async function secretsMatch(input: string, expected: string) {
  const [inputHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(input)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(inputHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function safeAdminReturnTo(value: unknown) {
  return typeof value === "string" && /^\/admin(?:[/?#]|$)[^\u0000-\u001f\u007f\\]*$/.test(value)
    ? value
    : "/admin";
}

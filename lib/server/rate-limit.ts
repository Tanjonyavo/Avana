import "server-only";
import { createHash, createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { LocalRateLimiter } from "@/lib/server/local-rate-limit";

const localLimiter = new LocalRateLimiter();

export function requestFingerprint(request: NextRequest) {
  const forwarded =
    (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for"))
      ?.split(",")[0]
      ?.trim() || "local";
  return createHash("sha256").update(forwarded).digest("hex").slice(0, 32);
}

export function sensitiveRateLimitIdentifier(value: string) {
  const normalized = value.trim().toLowerCase();
  const secret = process.env.SESSION_SECRET;
  const digest = secret
    ? createHmac("sha256", secret).update(normalized).digest("hex")
    : createHash("sha256").update(normalized).digest("hex");
  return digest.slice(0, 32);
}

export async function rateLimit(scope: string, identifier: string, maximum: number, windowSeconds: number) {
  const key = `${scope}:${identifier}`;
  if (!isSupabaseAdminConfigured()) return localLimiter.allowed(key, maximum, windowSeconds);

  const { data, error } = await getSupabaseAdmin().rpc("check_rate_limit", {
    key_value: key,
    maximum_requests: maximum,
    window_seconds: windowSeconds,
  });
  if (error) {
    console.error("AVANA rate limit unavailable", { scope, code: error.code });
    return false;
  }
  return data === true;
}

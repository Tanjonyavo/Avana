import { NextRequest, NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/site";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { hashSubscriberToken } from "@/lib/server/subscriber-tokens";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { rateLimit, requestFingerprint } from "@/lib/server/rate-limit";

async function unsubscribe(token: string) {
  if (!isSupabaseAdminConfigured() || token.length < 32 || token.length > 256) return false;
  const { error, count } = await getSupabaseAdmin()
    .from("newsletter_subscribers")
    .update(
      { status: "unsubscribed", unsubscribed_at: new Date().toISOString(), confirmation_token_hash: null },
      { count: "exact" },
    )
    .eq("unsubscribe_token_hash", hashSubscriberToken(token));
  return !error && Boolean(count);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  return NextResponse.redirect(absoluteUrl(`/infolettre/desabonnement?token=${encodeURIComponent(token)}`));
}

export async function POST(request: NextRequest) {
  if (!(await rateLimit("newsletter-unsubscribe", requestFingerprint(request), 30, 10 * 60))) {
    return new NextResponse(null, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  const token = request.nextUrl.searchParams.get("token") || "";
  await unsubscribe(token);
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

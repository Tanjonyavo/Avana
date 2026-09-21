import { NextRequest, NextResponse } from "next/server";
import { analyticsEventSchema } from "@/lib/validation";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { hasValidOrigin } from "@/lib/server/request";
import { rateLimit, requestFingerprint } from "@/lib/server/rate-limit";
import { readJsonBody } from "@/lib/server/request-body";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return new NextResponse(null, { status: 204 });
  if (!isSupabaseAdminConfigured()) return new NextResponse(null, { status: 204 });
  if (!(await rateLimit("analytics", requestFingerprint(request), 120, 10 * 60))) {
    return new NextResponse(null, { status: 204 });
  }
  const parsed = analyticsEventSchema.safeParse(await readJsonBody(request, 8_000).catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });
  const { error } = await getSupabaseAdmin().from("analytics_events").insert({
    event_name: parsed.data.eventName,
    anonymous_id: parsed.data.anonymousId,
    path: parsed.data.path,
    properties: parsed.data.properties,
  });
  if (error) console.error("AVANA analytics write failed", { code: error.code });
  return new NextResponse(null, { status: 204 });
}

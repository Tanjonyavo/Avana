import { NextResponse } from "next/server";
import { COMMERCE_ENABLED } from "@/lib/site";
import { getCommerceReadiness, isSupabaseAdminConfigured } from "@/lib/server/config";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = getCommerceReadiness();
  let database = !COMMERCE_ENABLED;
  if (isSupabaseAdminConfigured()) {
    const schemaVersion = await getSupabaseAdmin().rpc("commerce_schema_version");
    database = !schemaVersion.error && schemaVersion.data === 6;
  }
  const healthy = !COMMERCE_ENABLED || (readiness.ready && database);
  return NextResponse.json(
    {
      ok: healthy,
      mode: COMMERCE_ENABLED ? "commerce" : "demo",
      checkout: COMMERCE_ENABLED ? (healthy ? "ready" : "unavailable") : "disabled",
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

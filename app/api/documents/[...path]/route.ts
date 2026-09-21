import { NextRequest, NextResponse } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { privateFileResponse } from "@/lib/server/private-file-response";
import { rateLimit, requestFingerprint } from "@/lib/server/rate-limit";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { isPublicDocumentStoragePath } from "@/lib/upload-security";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Document indisponible." }, { status: 503 });
  }
  if (!(await rateLimit("public-document", requestFingerprint(request), 60, 5 * 60))) {
    return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
  }
  const { path: segments } = await context.params;
  const path = segments.join("/");
  if (!isPublicDocumentStoragePath(path)) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }
  const url = `/api/documents/${segments.map(encodeURIComponent).join("/")}`;
  const { data, error } = await getSupabaseAdmin()
    .from("lots")
    .select("id")
    .eq("public_traceability_enabled", true)
    .neq("status", "Archivé")
    .contains("public_documents", [{ url }])
    .limit(1);
  if (error || !data?.length) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }
  return (
    (await privateFileResponse(path)) ||
    NextResponse.json({ error: "Document introuvable." }, { status: 404 })
  );
}

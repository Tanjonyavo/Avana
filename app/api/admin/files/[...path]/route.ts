import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { privateFileResponse } from "@/lib/server/private-file-response";
import { isPrivateDocumentStoragePath } from "@/lib/upload-security";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Le stockage n’est pas configuré." }, { status: 503 });
  }
  const { path: segments } = await context.params;
  const path = segments.join("/");
  if (!isPrivateDocumentStoragePath(path)) {
    return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
  }
  return (
    (await privateFileResponse(path)) || NextResponse.json({ error: "Fichier introuvable." }, { status: 404 })
  );
}

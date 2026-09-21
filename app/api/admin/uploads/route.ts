import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { recordAuditLog } from "@/lib/server/orders";
import { readMultipartFormData, RequestBodyTooLargeError } from "@/lib/server/request-body";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { MAX_UPLOAD_BYTES, validateUploadedFile } from "@/lib/upload-security";

export const runtime = "nodejs";

const publicBucket = "avana-public";
const privateBucket = "avana-private";
export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Le stockage Supabase n’est pas configuré." }, { status: 503 });
  }
  const declaredLength = request.headers.get("content-length");
  if (!declaredLength || !/^\d+$/.test(declaredLength) || Number(declaredLength) < 1) {
    return NextResponse.json({ error: "Taille du téléversement absente ou invalide." }, { status: 411 });
  }
  if (Number(declaredLength) > 8_500_000) {
    return NextResponse.json({ error: "Le téléversement dépasse 8 Mo." }, { status: 413 });
  }

  let form: FormData | null = null;
  try {
    form = await readMultipartFormData(request, 8_500_000);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Le téléversement dépasse 8 Mo." }, { status: 413 });
    }
  }
  const file = form?.get("file");
  const folder = String(form?.get("folder") || "");
  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json({ error: "Fichier ou destination invalide." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Le fichier doit être inférieur ou égal à 8 Mo." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateUploadedFile({ folder, fileName: file.name, mimeType: file.type, bytes });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }
  const date = new Date();
  const path = `${folder}/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${validation.extension}`;
  const client = getSupabaseAdmin();
  const bucket = folder === "products" ? publicBucket : privateBucket;
  const { error } = await client.storage.from(bucket).upload(path, bytes, {
    cacheControl: bucket === publicBucket ? "31536000" : "0",
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    console.error("AVANA asset upload failed", { code: error.name });
    return NextResponse.json({ error: "Le fichier n’a pas pu être téléversé." }, { status: 502 });
  }
  const url =
    bucket === publicBucket
      ? client.storage.from(bucket).getPublicUrl(path).data.publicUrl
      : folder === "public-documents"
        ? `/api/documents/${path.split("/").map(encodeURIComponent).join("/")}`
        : `/api/admin/files/${path.split("/").map(encodeURIComponent).join("/")}`;
  await recordAuditLog({
    action: "asset.uploaded",
    entityType: folder,
    entityId: path,
    metadata: { type: file.type, size: file.size, private: bucket === privateBucket },
  });
  return NextResponse.json({ ok: true, url, path }, { status: 201 });
}

import "server-only";

import { MAX_UPLOAD_BYTES } from "@/lib/upload-security";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

const contentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
};

export async function privateFileResponse(path: string) {
  const extension = path.split(".").pop()?.toLowerCase() || "";
  const contentType = contentTypes[extension];
  if (!contentType) return null;
  const { data, error } = await getSupabaseAdmin().storage.from("avana-private").download(path);
  if (error || !data || data.size < 1 || data.size > MAX_UPLOAD_BYTES) return null;
  const identifier =
    path
      .split("/")
      .pop()
      ?.split(".")[0]
      ?.replace(/[^0-9a-f-]/gi, "") || "avana";
  return new Response(await data.arrayBuffer(), {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="avana-${identifier}.${extension}"`,
      "Content-Length": String(data.size),
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Type": contentType,
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

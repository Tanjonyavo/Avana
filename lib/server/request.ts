import "server-only";

import type { NextRequest } from "next/server";

export function hasValidOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const candidate = origin || request.headers.get("referer");
  if (!candidate) return process.env.NODE_ENV !== "production";
  try {
    let expectedOrigin = request.nextUrl.origin;
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL) {
      expectedOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL).origin;
    }
    return new URL(candidate).origin === expectedOrigin;
  } catch {
    return false;
  }
}

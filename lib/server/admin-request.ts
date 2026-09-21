import "server-only";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminAuthConfigured } from "@/lib/admin-auth";
import { isActiveAdminSession } from "@/lib/server/admin-session";
import { hasValidOrigin } from "@/lib/server/request";

export async function isAuthorizedAdminRequest(request: NextRequest, mutation = false) {
  if (!isAdminAuthConfigured()) return false;
  if (mutation && !hasValidOrigin(request)) return false;
  return isActiveAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

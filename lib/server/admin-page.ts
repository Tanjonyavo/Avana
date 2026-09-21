import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, isAdminAuthConfigured } from "@/lib/admin-auth";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { isActiveAdminSession } from "@/lib/server/admin-session";

export async function requireAdminPageSession() {
  // Preserve the local demo only when it cannot access real server data.
  if (process.env.NODE_ENV === "development" && !isAdminAuthConfigured() && !isSupabaseAdminConfigured())
    return;
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isActiveAdminSession(token))) redirect("/admin/connexion");
}

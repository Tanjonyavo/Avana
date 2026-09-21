import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { hasValidOrigin } from "@/lib/server/request";
import { revokeAdminSession } from "@/lib/server/admin-session";
import { recordAuditLog } from "@/lib/server/orders";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  }
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  let revoked: boolean;
  try {
    revoked = await revokeAdminSession(token);
  } catch {
    console.error("AVANA admin session revocation unavailable");
    // Keep the cookie so the browser can retry revocation. Never report success
    // when another holder could regain access after the database recovers.
    return NextResponse.json(
      { error: "Déconnexion non confirmée. Réessayez." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (revoked) {
    try {
      await recordAuditLog({ action: "admin.logout", entityType: "admin_session", entityId: "current" });
    } catch {
      console.error("AVANA admin logout audit unavailable");
    }
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  return response;
}

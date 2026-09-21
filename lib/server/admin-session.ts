import "server-only";
import { createHash } from "node:crypto";
import { createAdminSessionToken, isAdminAuthConfigured, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

function sessionHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Never cache a positive authorization across requests: logout must take effect
// on every instance. A signed cookie alone is no longer an admin session.
export async function isActiveAdminSession(token: string | undefined) {
  if (!isAdminAuthConfigured() || !(await verifyAdminSessionToken(token, process.env.SESSION_SECRET))) {
    return false;
  }
  try {
    const { data, error } = await getSupabaseAdmin().rpc("is_admin_session_active", {
      session_hash_value: sessionHash(token!),
      require_mfa: process.env.NODE_ENV === "production",
    });
    if (error) throw new Error("Session lookup failed");
    return data === true;
  } catch {
    console.error("AVANA admin session verification unavailable");
    return false;
  }
}

export async function registerAdminSession(previousToken: string | undefined, mfaVerified: boolean) {
  const token = await createAdminSessionToken(process.env.SESSION_SECRET!);
  const previousValid = await verifyAdminSessionToken(previousToken, process.env.SESSION_SECRET);
  const { error } = await getSupabaseAdmin().rpc("register_admin_session", {
    session_hash_value: sessionHash(token),
    expires_at_value: new Date(Number(token.split(".")[1]) * 1000).toISOString(),
    mfa_verified_value: mfaVerified,
    previous_hash_value: previousValid ? sessionHash(previousToken!) : null,
  });
  if (error) throw new Error("Session registration failed");
  return token;
}

export async function revokeAdminSession(token: string | undefined) {
  if (!(await verifyAdminSessionToken(token, process.env.SESSION_SECRET))) return false;
  const { data, error } = await getSupabaseAdmin().rpc("revoke_admin_session", {
    session_hash_value: sessionHash(token!),
  });
  if (error) throw new Error("Session revocation failed");
  return data === true;
}

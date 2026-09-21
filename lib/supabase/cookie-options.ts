import type { CookieOptions } from "@supabase/ssr";

// AVANA accesses Supabase Auth exclusively on the server. Lax permits the
// emailed PKCE callback while HttpOnly keeps both verifier and session out of JS.
export function authCookieOptions(): CookieOptions {
  return {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };
}

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { safeAdminReturnTo } from "@/lib/admin-auth";
import { absoluteUrl } from "@/lib/site";
import { isSupabaseAuthConfigured } from "@/lib/server/config";
import { authCookieOptions } from "@/lib/supabase/cookie-options";

function safeReturnTo(value: string | null) {
  if (!value || !/^\/(?!\/|api(?:\/|$))[^\u0000-\u001f\u007f\\]*$/.test(value)) return "/compte";
  return value.startsWith("/admin") ? safeAdminReturnTo(value) : value;
}

function authRedirect(path: string) {
  const response = NextResponse.redirect(absoluteUrl(path));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAuthConfigured()) return authRedirect("/compte?erreur=configuration");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const flowId = url.searchParams.get("sb_flow_id");
  const destination = safeReturnTo(url.searchParams.get("next"));
  const response = authRedirect(destination);
  if (!code || code.length > 2048 || (flowId !== null && !/^[A-Za-z0-9_-]{8,64}$/.test(flowId))) {
    return authRedirect("/compte?erreur=lien");
  }

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    },
  );
  const { error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
  if (error) return authRedirect("/compte?erreur=lien");
  return response;
}

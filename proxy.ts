import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminAuthConfigured, verifyAdminSessionToken } from "@/lib/admin-auth";
import { authCookieOptions } from "@/lib/supabase/cookie-options";

function isSupabaseAuthConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

async function refreshSupabaseSession(request: NextRequest, requestHeaders: Headers) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!/^\/(?:compte|commande)(?:\/|$)/.test(request.nextUrl.pathname) || !isSupabaseAuthConfigured()) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          requestHeaders.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}

function contentSecurityPolicy(nonce: string) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const upgrade = isDevelopment ? "" : "; upgrade-insecure-requests";
  let assetOrigin = "";
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    if (url.protocol === "https:") assetOrigin = ` ${url.origin}`;
  } catch {}
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${assetOrigin}`,
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    `form-action 'self'${upgrade}`,
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  let response: NextResponse;

  if (!request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname === "/admin/connexion") {
    response = await refreshSupabaseSession(request, requestHeaders);
    response.headers.set("Content-Security-Policy", policy);
    if (/^\/(?:admin|compte|commande|infolettre)(?:\/|$)/.test(request.nextUrl.pathname)) {
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
    }
    return response;
  }

  if (!isAdminAuthConfigured()) {
    if (process.env.NODE_ENV === "development") {
      response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set("x-avana-admin-mode", "local-development");
      response.headers.set("Content-Security-Policy", policy);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    const unavailable = new URL("/admin/connexion", request.url);
    unavailable.searchParams.set("configuration", "requise");
    response = NextResponse.redirect(unavailable);
    response.headers.set("Content-Security-Policy", policy);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (await verifyAdminSessionToken(token, process.env.SESSION_SECRET)) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", policy);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const login = new URL("/admin/connexion", request.url);
  login.searchParams.set("retour", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  response = NextResponse.redirect(login);
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico)$).*)"],
};

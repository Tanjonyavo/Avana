import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { absoluteUrl } from "@/lib/site";
import { isSupabaseAuthConfigured } from "@/lib/server/config";
import { hasValidOrigin } from "@/lib/server/request";
import { readJsonBody } from "@/lib/server/request-body";
import { rateLimit, requestFingerprint, sensitiveRateLimitIdentifier } from "@/lib/server/rate-limit";
import { authCookieOptions } from "@/lib/supabase/cookie-options";

const requestSchema = z.strictObject({ email: z.string().trim().email().max(254) });

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request))
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "Les comptes clients ne sont pas encore configurés." },
      { status: 503 },
    );
  }
  if (!(await rateLimit("magic-link", requestFingerprint(request), 5, 15 * 60))) {
    return NextResponse.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429 });
  }

  const parsed = requestSchema.safeParse(await readJsonBody(request, 4_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Adresse courriel invalide." }, { status: 400 });
  if (
    !(await rateLimit("magic-link-recipient", sensitiveRateLimitIdentifier(parsed.data.email), 3, 60 * 60))
  ) {
    return NextResponse.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429 });
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookieOptions: authCookieOptions(),
      auth: { experimental: { appendPkceFlowIdToRedirects: true } },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    },
  );
  const { error } = await client.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: absoluteUrl("/api/auth/callback?next=/compte"), shouldCreateUser: true },
  });
  if (error) {
    console.error("AVANA magic link failed", { code: error.code });
    return NextResponse.json({ error: "Le lien de connexion n’a pas pu être envoyé." }, { status: 502 });
  }
  return response;
}

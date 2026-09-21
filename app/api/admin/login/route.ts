import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_SECONDS,
  createAdminOtpReplayIdentifier,
  isAdminAuthConfigured,
  safeAdminReturnTo,
  secretsMatch,
  verifyTotp,
} from "@/lib/admin-auth";
import { hasValidOrigin } from "@/lib/server/request";
import { readJsonBody } from "@/lib/server/request-body";
import { rateLimit, requestFingerprint } from "@/lib/server/rate-limit";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { recordAuditLog } from "@/lib/server/orders";
import { registerAdminSession } from "@/lib/server/admin-session";

const loginSchema = z.strictObject({
  password: z.string().min(1).max(300),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
  returnTo: z.string().max(2048).optional(),
});

async function auditLogin(action: "admin.login_failed" | "admin.login_succeeded", identifier: string) {
  if (!isSupabaseAdminConfigured()) return;
  try {
    await recordAuditLog({ actor: "admin-auth", action, entityType: "admin_session", entityId: identifier });
  } catch {
    console.error("AVANA admin login audit unavailable");
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  }
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: "L’accès administrateur n’est pas configuré." }, { status: 503 });
  }

  const identifier = requestFingerprint(request);
  if (!(await rateLimit("admin-login", identifier, 6, 15 * 60))) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, { status: 429 });
  }

  const parsed = loginSchema.safeParse(await readJsonBody(request, 4_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mot de passe requis." }, { status: 400 });

  const [validPassword, validOtp] = await Promise.all([
    secretsMatch(parsed.data.password, process.env.ADMIN_PASSWORD!),
    process.env.ADMIN_TOTP_SECRET
      ? verifyTotp(parsed.data.otp, process.env.ADMIN_TOTP_SECRET)
      : Promise.resolve(process.env.NODE_ENV !== "production"),
  ]);
  if (!validPassword || !validOtp) {
    await auditLogin("admin.login_failed", identifier);
    await new Promise((resolve) => setTimeout(resolve, 650));
    return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
  }

  if (
    process.env.ADMIN_TOTP_SECRET &&
    !(await rateLimit(
      "admin-totp-replay",
      await createAdminOtpReplayIdentifier(parsed.data.otp, process.env.SESSION_SECRET!),
      1,
      90,
    ))
  ) {
    await auditLogin("admin.login_failed", identifier);
    return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
  }

  let token: string;
  try {
    token = await registerAdminSession(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
      Boolean(process.env.ADMIN_TOTP_SECRET && validOtp),
    );
  } catch {
    console.error("AVANA admin session creation unavailable");
    return NextResponse.json(
      { error: "Connexion temporairement indisponible. Réessayez." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const response = NextResponse.json(
    { ok: true, returnTo: safeAdminReturnTo(parsed.data.returnTo) },
    { headers: { "Cache-Control": "no-store" } },
  );
  await auditLogin("admin.login_succeeded", identifier);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_SECONDS,
    path: "/",
  });
  return response;
}

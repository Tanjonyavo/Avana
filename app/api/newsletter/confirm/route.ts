import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { absoluteUrl } from "@/lib/site";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { enqueueNotification, processPendingNotifications } from "@/lib/server/notifications";
import { hasValidOrigin } from "@/lib/server/request";
import { readJsonBody } from "@/lib/server/request-body";
import { createUnsubscribeToken, hashSubscriberToken } from "@/lib/server/subscriber-tokens";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { rateLimit, requestFingerprint } from "@/lib/server/rate-limit";

const schema = z.object({ token: z.string().min(32).max(256) });

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  return NextResponse.redirect(absoluteUrl(`/infolettre/confirmer?token=${encodeURIComponent(token)}`));
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request))
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  if (!(await rateLimit("newsletter-confirm", requestFingerprint(request), 30, 10 * 60))) {
    return NextResponse.json({ error: "Trop de demandes." }, { status: 429 });
  }
  const parsed = schema.safeParse(await readJsonBody(request, 4_000).catch(() => null));
  if (!isSupabaseAdminConfigured() || !parsed.success) {
    return NextResponse.json({ error: "Ce lien n’est pas valide." }, { status: 400 });
  }
  const hash = hashSubscriberToken(parsed.data.token);
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("newsletter_subscribers")
    .select("email, confirmation_expires_at")
    .eq("confirmation_token_hash", hash)
    .eq("status", "pending")
    .maybeSingle();
  if (
    error ||
    !data ||
    !data.confirmation_expires_at ||
    new Date(data.confirmation_expires_at) <= new Date()
  ) {
    return NextResponse.json({ error: "Ce lien est expiré ou a déjà été utilisé." }, { status: 410 });
  }
  const { data: confirmed, error: updateError } = await client
    .from("newsletter_subscribers")
    .update({
      status: "subscribed",
      confirmed_at: new Date().toISOString(),
      confirmation_token_hash: null,
      confirmation_expires_at: null,
    })
    .eq("email", data.email)
    .eq("confirmation_token_hash", hash)
    .select("email")
    .maybeSingle();
  if (updateError || !confirmed)
    return NextResponse.json({ error: "Confirmation impossible." }, { status: 409 });
  try {
    const unsubscribe = createUnsubscribeToken(data.email);
    await enqueueNotification({
      kind: "newsletter_welcome",
      recipientEmail: data.email,
      payload: {
        unsubscribeUrl: absoluteUrl(
          `/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribe.token)}`,
        ),
      },
      dedupeKey: `newsletter-welcome-${hashSubscriberToken(data.email).slice(0, 32)}`,
    });
    await processPendingNotifications(5);
  } catch {
    console.error("AVANA newsletter welcome could not be sent");
  }
  return NextResponse.json({ ok: true });
}

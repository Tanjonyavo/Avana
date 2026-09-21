import "server-only";

import { absoluteUrl } from "@/lib/site";
import { commerceSettings, isEmailConfigured, isSupabaseAdminConfigured } from "@/lib/server/config";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { createSubscriberToken, createUnsubscribeToken } from "@/lib/server/subscriber-tokens";
import type { Submission } from "@/lib/validation";

type DeliveryResult = { channel: "supabase" | "email"; ok: boolean };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function cleanSubmission(submission: Submission) {
  const payload = { ...submission } as Record<string, unknown>;
  delete payload._gotcha;
  return payload;
}

async function saveSubmission(submission: Submission): Promise<DeliveryResult | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const table = "submissions";
  const { error } = await getSupabaseAdmin()
    .from(table)
    .insert({
      kind: submission.kind,
      payload: cleanSubmission(submission),
      source: "avana-web",
      status: submission.kind === "b2b" ? "Nouveau lead" : "new",
    });
  if (error) throw new Error(`Supabase responded with ${error.code}`);
  return { channel: "supabase", ok: true };
}

async function sendEmail(input: { to: string; subject: string; html: string; idempotencyKey: string }) {
  if (!isEmailConfigured()) return null;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [input.to],
      reply_to: process.env.BUSINESS_SUPPORT_EMAIL || undefined,
      subject: input.subject,
      html: input.html,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Resend responded with ${response.status}`);
  return { channel: "email", ok: true } as DeliveryResult;
}

async function sendInternalSubmissionEmail(submission: Submission) {
  const to = process.env.CONTACT_TO_EMAIL;
  if (!to) return null;
  const safePayload = escapeHtml(JSON.stringify(cleanSubmission(submission), null, 2));
  return sendEmail({
    to,
    subject: `AVANA · Nouvelle demande ${submission.kind}`,
    html: `<h1>Nouvelle demande AVANA</h1><p>Type : <strong>${escapeHtml(submission.kind)}</strong></p><pre>${safePayload}</pre>`,
    idempotencyKey: `avana-submission-${crypto.randomUUID()}`,
  });
}

async function sendSubmissionAcknowledgement(submission: Exclude<Submission, { kind: "newsletter" }>) {
  const email = submission.email.trim().toLowerCase();
  const firstName =
    submission.kind === "b2b" ? submission.firstName : submission.kind === "contact" ? submission.name : "";
  const subject =
    submission.kind === "b2b"
      ? "Votre demande professionnelle AVANA"
      : submission.kind === "waitlist"
        ? "Votre intérêt pour AVANA est enregistré"
        : "Nous avons reçu votre message AVANA";
  const description =
    submission.kind === "b2b"
      ? "Notre équipe examinera votre entreprise, vos usages et vos volumes avant de vous répondre."
      : submission.kind === "waitlist"
        ? "Nous vous écrirons lorsque le format demandé sera disponible."
        : "Notre équipe a bien reçu votre demande et vous répondra dès que possible.";
  const support = commerceSettings.business.supportEmail;
  return sendEmail({
    to: email,
    subject,
    idempotencyKey: `avana-ack-${submission.kind}-${crypto.randomUUID()}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px"><strong style="letter-spacing:.16em">AVANA</strong><h1 style="font-family:Georgia,serif">Demande bien reçue.</h1><p>${firstName ? `Bonjour ${escapeHtml(firstName)}, ` : ""}${escapeHtml(description)}</p><p style="color:#6d675f;font-size:13px">${escapeHtml(commerceSettings.business.name)}${support ? ` · ${escapeHtml(support)}` : ""}</p></div>`,
  });
}

async function subscribeToNewsletter(submission: Extract<Submission, { kind: "newsletter" }>) {
  if (!isSupabaseAdminConfigured() || !isEmailConfigured()) return [];
  const email = submission.email.trim().toLowerCase();
  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("newsletter_subscribers")
    .select("status")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) throw new Error(`Subscriber lookup failed: ${lookupError.code}`);
  if (existing?.status === "subscribed") return [{ channel: "supabase", ok: true } as DeliveryResult];

  const confirmation = createSubscriberToken();
  const unsubscribe = createUnsubscribeToken(email);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { error } = await getSupabaseAdmin()
    .from("newsletter_subscribers")
    .upsert({
      email,
      status: "pending",
      consent_source: submission.source || "site",
      consent_at: new Date().toISOString(),
      confirmation_token_hash: confirmation.hash,
      confirmation_expires_at: expiresAt,
      unsubscribe_token_hash: unsubscribe.hash,
      unsubscribed_at: null,
    });
  if (error) throw new Error(`Subscriber could not be saved: ${error.code}`);

  const confirmUrl = absoluteUrl(`/infolettre/confirmer?token=${encodeURIComponent(confirmation.token)}`);
  const emailResult = await sendEmail({
    to: email,
    subject: "Confirmez votre inscription AVANA",
    idempotencyKey: `avana-newsletter-confirm-${confirmation.hash.slice(0, 24)}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px"><h1 style="font-family:Georgia,serif">Confirmez votre inscription.</h1><p>Vous avez demandé à recevoir les nouvelles AVANA. Confirmez votre adresse dans les 48 heures.</p><p style="margin:28px 0"><a href="${escapeHtml(confirmUrl)}" style="background:#153f36;color:#fff;padding:13px 20px;text-decoration:none;border-radius:999px">Confirmer mon inscription</a></p><p style="color:#6d675f;font-size:13px">Si vous n’êtes pas à l’origine de cette demande, ignorez simplement ce courriel.</p></div>`,
  });
  return [{ channel: "supabase", ok: true } as DeliveryResult, ...(emailResult ? [emailResult] : [])];
}

export async function deliverSubmission(submission: Submission) {
  if (submission.kind === "newsletter") {
    const delivered = await subscribeToNewsletter(submission);
    if (!delivered.length) return { mode: "demo" as const, channels: [] };
    return { mode: "live" as const, channels: delivered.map((result) => result.channel) };
  }

  if (!isSupabaseAdminConfigured() && !(isEmailConfigured() && process.env.CONTACT_TO_EMAIL)) {
    return { mode: "demo" as const, channels: [] };
  }
  const configured = [
    saveSubmission(submission),
    sendInternalSubmissionEmail(submission),
    sendSubmissionAcknowledgement(submission),
  ];
  const settled = await Promise.allSettled(configured);
  const delivered = settled.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
  settled.forEach((result, index) => {
    if (result.status === "rejected")
      console.error("AVANA submission delivery failed", { channel: index + 1 });
  });
  if (!delivered.length) throw new Error("No configured delivery channel succeeded");
  return { mode: "live" as const, channels: delivered.map((result) => result.channel) };
}

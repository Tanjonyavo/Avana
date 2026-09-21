import "server-only";
import { absoluteUrl } from "@/lib/site";
import { commerceSettings, isEmailConfigured } from "@/lib/server/config";
import { getOrderAccessLinkData, listLowStockVariants } from "@/lib/server/orders";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

interface NotificationRow {
  id: string;
  order_id: string | null;
  kind: string;
  recipient_email: string;
  payload: Record<string, unknown>;
  attempts: number;
}

interface EmailContent {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
}

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

function currency(cents: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

function emailDocument(content: EmailContent) {
  const support = commerceSettings.business.supportEmail;
  const address = [
    commerceSettings.business.addressLine1,
    commerceSettings.business.addressLine2,
    commerceSettings.business.city,
    commerceSettings.business.province,
    commerceSettings.business.postalCode,
    commerceSettings.business.country,
  ]
    .filter(Boolean)
    .join(", ");
  const action =
    content.actionLabel && content.actionUrl
      ? `<p style="margin:28px 0"><a href="${escapeHtml(content.actionUrl)}" style="background:#153f36;color:#fff;padding:13px 20px;text-decoration:none;border-radius:999px;display:inline-block">${escapeHtml(content.actionLabel)}</a></p>`
      : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(content.subject)}</title></head><body style="margin:0;background:#f4f0e8;color:#26231f;font-family:Arial,sans-serif"><span style="display:none;max-height:0;overflow:hidden">${escapeHtml(content.preheader)}</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:30px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:auto;background:#fff;border-radius:18px;overflow:hidden"><tr><td style="padding:30px;border-bottom:1px solid #e8e0d4"><strong style="font-size:24px;letter-spacing:.18em">AVANA</strong></td></tr><tr><td style="padding:34px 30px"><h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.15;margin:0 0 18px">${escapeHtml(content.heading)}</h1>${content.body}${action}</td></tr><tr><td style="padding:22px 30px;background:#153f36;color:#e9e4da;font-size:13px;line-height:1.6">${escapeHtml(commerceSettings.business.name)}${address ? `<br>${escapeHtml(address)}` : ""}${commerceSettings.business.phone ? `<br>${escapeHtml(commerceSettings.business.phone)}` : ""}${support ? ` · <a href="mailto:${escapeHtml(support)}" style="color:#fff">${escapeHtml(support)}</a>` : ""}</td></tr></table></td></tr></table></body></html>`;
}

async function buildOrderEmail(notification: NotificationRow): Promise<EmailContent> {
  if (!notification.order_id) throw new Error("Order notification is missing its order ID");
  const access = await getOrderAccessLinkData(notification.order_id);
  if (!access) throw new Error("Order notification references an unknown order");
  const { order, accessToken } = access;
  const orderUrl = absoluteUrl(
    `/commande/${encodeURIComponent(order.number)}?token=${encodeURIComponent(accessToken)}`,
  );
  const items = order.items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0">${item.quantity} × ${escapeHtml(item.productName)} <span style="color:#746d62">${escapeHtml(item.variantLabel)}</span></td><td style="padding:8px 0;text-align:right">${currency(item.lineTotalCents)}</td></tr>`,
    )
    .join("");
  const discount =
    order.discountCents > 0
      ? `<tr><td style="padding:8px 0">Remise</td><td style="padding:8px 0;text-align:right">−${currency(order.discountCents)}</td></tr>`
      : "";
  const summary = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border-top:1px solid #e8e0d4;border-bottom:1px solid #e8e0d4">${items}<tr><td style="padding:8px 0">Sous-total</td><td style="padding:8px 0;text-align:right">${currency(order.subtotalCents)}</td></tr><tr><td style="padding:8px 0">Livraison</td><td style="padding:8px 0;text-align:right">${currency(order.shippingCents)}</td></tr>${discount}<tr><td style="padding:8px 0">Taxes</td><td style="padding:8px 0;text-align:right">${currency(order.taxCents)}</td></tr><tr><td style="padding:12px 0"><strong>Total</strong></td><td style="padding:12px 0;text-align:right"><strong>${currency(order.totalCents)}</strong></td></tr></table>`;

  if (notification.kind === "admin_order_paid") {
    return {
      subject: `Nouvelle commande payée · ${order.number}`,
      preheader: `${order.customerName} · ${currency(order.totalCents)}`,
      heading: "Une nouvelle commande est prête.",
      body: `<p><strong>${escapeHtml(order.number)}</strong> a été payée par ${escapeHtml(order.customerName)}.</p>${summary}`,
      actionLabel: "Ouvrir les commandes",
      actionUrl: absoluteUrl("/admin/commandes"),
    };
  }

  if (notification.kind === "order_access") {
    return {
      subject: `Accès à votre commande · ${order.number}`,
      preheader: "Votre lien privé AVANA est prêt.",
      heading: "Retrouvez votre commande.",
      body: `<p>Bonjour ${escapeHtml(order.customerName)},</p><p>Voici le lien privé demandé pour consulter la commande <strong>${escapeHtml(order.number)}</strong> et son suivi.</p><p style="color:#746d62;font-size:13px">Si vous n’avez pas demandé ce lien, vous pouvez ignorer ce message.</p>`,
      actionLabel: "Voir ma commande",
      actionUrl: orderUrl,
    };
  }

  if (notification.kind === "admin_dispute") {
    return {
      subject: `Action requise · litige ${order.number}`,
      preheader: "Un litige Stripe exige votre attention.",
      heading: "Un paiement est contesté.",
      body: `<p>Stripe a signalé un litige pour la commande <strong>${escapeHtml(order.number)}</strong>. Vérifiez immédiatement les preuves et les délais dans le tableau de bord Stripe.</p>`,
      actionLabel: "Ouvrir les commandes",
      actionUrl: absoluteUrl("/admin/commandes"),
    };
  }

  if (notification.kind === "admin_refund_failed") {
    return {
      subject: `Action requise · remboursement ${order.number}`,
      preheader: "Stripe n’a pas pu finaliser un remboursement.",
      heading: "Un remboursement a échoué.",
      body: `<p>Le remboursement de la commande <strong>${escapeHtml(order.number)}</strong> n’a pas été finalisé. Vérifiez le motif et le solde disponible dans Stripe avant de réessayer.</p>`,
      actionLabel: "Ouvrir les commandes",
      actionUrl: absoluteUrl("/admin/commandes"),
    };
  }

  if (notification.kind === "order_shipped") {
    const carrier = String(notification.payload.carrier || "le transporteur");
    const trackingNumber = String(notification.payload.trackingNumber || "");
    const trackingUrl = String(notification.payload.trackingUrl || orderUrl);
    return {
      subject: `Votre commande ${order.number} est expédiée`,
      preheader: `Suivez votre colis ${trackingNumber}.`,
      heading: "Votre vanille est en route.",
      body: `<p>Bonjour ${escapeHtml(order.customerName)},</p><p>Votre commande <strong>${escapeHtml(order.number)}</strong> a été remise à ${escapeHtml(carrier)}.</p><p>Numéro de suivi : <strong>${escapeHtml(trackingNumber)}</strong></p>`,
      actionLabel: "Suivre le colis",
      actionUrl: trackingUrl,
    };
  }

  if (notification.kind === "order_refunded") {
    return {
      subject: `Remboursement confirmé · ${order.number}`,
      preheader: "Le remboursement de votre commande a été confirmé.",
      heading: "Votre remboursement est confirmé.",
      body: `<p>Bonjour ${escapeHtml(order.customerName)},</p><p>Le remboursement de la commande <strong>${escapeHtml(order.number)}</strong> a été confirmé. Le délai bancaire peut varier selon votre institution.</p>`,
      actionLabel: "Voir la commande",
      actionUrl: orderUrl,
    };
  }

  if (notification.kind === "order_partially_refunded") {
    const refundedCents = Number(notification.payload.refundedCents || order.refundedCents);
    return {
      subject: `Remboursement partiel confirmé · ${order.number}`,
      preheader: `${currency(refundedCents)} ont été remboursés.`,
      heading: "Votre remboursement partiel est confirmé.",
      body: `<p>Bonjour ${escapeHtml(order.customerName)},</p><p>Un montant cumulatif de <strong>${currency(refundedCents)}</strong> a été remboursé sur la commande <strong>${escapeHtml(order.number)}</strong>. Le délai bancaire peut varier selon votre institution.</p>`,
      actionLabel: "Voir la commande",
      actionUrl: orderUrl,
    };
  }

  if (notification.kind === "order_delivered") {
    return {
      subject: `Commande livrée · ${order.number}`,
      preheader: "Votre commande AVANA est arrivée.",
      heading: "Votre commande a été livrée.",
      body: `<p>Bonjour ${escapeHtml(order.customerName)},</p><p>Le transporteur indique que la commande <strong>${escapeHtml(order.number)}</strong> a été livrée. Nous espérons que vous apprécierez votre vanille AVANA.</p>`,
      actionLabel: "Voir ma commande",
      actionUrl: orderUrl,
    };
  }

  return {
    subject: `Commande confirmée · ${order.number}`,
    preheader: `Nous préparons votre commande AVANA de ${currency(order.totalCents)}.`,
    heading: "Merci pour votre commande.",
    body: `<p>Bonjour ${escapeHtml(order.customerName)},</p><p>Le paiement de la commande <strong>${escapeHtml(order.number)}</strong> est confirmé. Livraison ${order.shippingMethod === "express" ? "express, généralement 1 à 3 jours ouvrables après expédition" : "standard, généralement 3 à 6 jours ouvrables après expédition"}. Nous vous écrirons dès son expédition.</p>${summary}<p style="font-size:13px;color:#746d62">Cette confirmation constitue votre copie de la commande. Consultez les <a href="${absoluteUrl("/politiques/conditions")}">conditions</a>, la <a href="${absoluteUrl("/politiques/livraison")}">livraison</a> et les <a href="${absoluteUrl("/politiques/retours")}">retours</a>.</p>`,
    actionLabel: "Voir et suivre la commande",
    actionUrl: orderUrl,
  };
}

function buildGeneralEmail(notification: NotificationRow): EmailContent {
  if (notification.kind === "newsletter_campaign") {
    const body = escapeHtml(String(notification.payload.body || "")).replace(/\n/g, "<br>");
    const unsubscribeUrl = escapeHtml(String(notification.payload.unsubscribeUrl || ""));
    const actionUrl = String(notification.payload.actionUrl || "");
    return {
      subject: String(notification.payload.subject || "Nouvelles AVANA"),
      preheader: String(notification.payload.preheader || "Le journal AVANA"),
      heading: String(notification.payload.heading || "Nouvelles AVANA"),
      body: `<p>${body}</p><p style="font-size:13px;color:#746d62">Vous recevez ce message après avoir confirmé votre inscription. <a href="${unsubscribeUrl}">Se désabonner en un clic</a>.</p>`,
      actionLabel: actionUrl ? String(notification.payload.actionLabel || "Découvrir") : undefined,
      actionUrl: actionUrl || undefined,
    };
  }
  if (notification.kind === "newsletter_welcome") {
    const unsubscribeUrl = String(notification.payload.unsubscribeUrl || "");
    return {
      subject: "Bienvenue dans le journal AVANA",
      preheader: "Votre inscription est confirmée.",
      heading: "Bienvenue dès l’origine.",
      body: `<p>Votre adresse est confirmée. Vous recevrez les nouvelles produits, les essais et les étapes importantes du lancement AVANA.</p><p style="font-size:13px;color:#746d62">Vous pouvez <a href="${escapeHtml(unsubscribeUrl)}">vous désabonner en un clic</a> à tout moment.</p>`,
      actionLabel: "Découvrir AVANA",
      actionUrl: absoluteUrl("/notre-histoire"),
    };
  }
  if (notification.kind === "low_stock") {
    const items = Array.isArray(notification.payload.items)
      ? (notification.payload.items as Array<Record<string, unknown>>)
          .map(
            (item) =>
              `<li><strong>${escapeHtml(String(item.sku || ""))}</strong> · ${escapeHtml(String(item.productName || "Produit"))} — ${escapeHtml(String(item.available ?? 0))} disponible(s)</li>`,
          )
          .join("")
      : "";
    return {
      subject: "AVANA · Stock faible",
      preheader: "Un ou plusieurs formats nécessitent votre attention.",
      heading: "Le stock approche du seuil minimum.",
      body: `<p>Vérifiez ces formats avant de poursuivre les ventes :</p><ul>${items}</ul>`,
      actionLabel: "Gérer les produits",
      actionUrl: absoluteUrl("/admin/produits"),
    };
  }
  return {
    subject: String(notification.payload.subject || "Notification AVANA"),
    preheader: String(notification.payload.preheader || "Nouvelle notification AVANA"),
    heading: String(notification.payload.heading || "AVANA"),
    body: `<p>${escapeHtml(String(notification.payload.body || ""))}</p>`,
  };
}

async function sendEmail(notification: NotificationRow, content: EmailContent) {
  if (!isEmailConfigured()) throw new Error("Resend is not configured");
  const unsubscribeUrl =
    typeof notification.payload.unsubscribeUrl === "string" ? notification.payload.unsubscribeUrl : "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `avana-notification-${notification.id}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [notification.recipient_email],
      reply_to: commerceSettings.business.supportEmail || undefined,
      subject: content.subject,
      html: emailDocument(content),
      headers: unsubscribeUrl
        ? {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Resend responded with ${response.status}`);
}

export async function enqueueNotification(input: {
  orderId?: string;
  kind: string;
  recipientEmail: string;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
}) {
  const { error } = await getSupabaseAdmin()
    .from("notifications")
    .upsert(
      {
        order_id: input.orderId || null,
        kind: input.kind,
        recipient_email: input.recipientEmail,
        payload: input.payload || {},
        dedupe_key: input.dedupeKey || null,
      },
      { onConflict: "dedupe_key", ignoreDuplicates: Boolean(input.dedupeKey) },
    );
  if (error) throw new Error(`Notification could not be queued: ${error.code}`);
}

export async function processPendingNotifications(limit = 20) {
  const client = getSupabaseAdmin();
  const { error: recoveryError } = await client
    .from("notifications")
    .update({
      status: "failed",
      last_error: "Traitement interrompu; nouvelle tentative planifiée.",
      scheduled_at: new Date().toISOString(),
    })
    .eq("status", "processing")
    .lt("updated_at", new Date(Date.now() - 15 * 60_000).toISOString());
  if (recoveryError) throw new Error(`Notification recovery failed: ${recoveryError.code}`);

  const { data, error } = await client
    .from("notifications")
    .select("id, order_id, kind, recipient_email, payload, attempts")
    .in("status", ["pending", "failed"])
    .lt("attempts", 5)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 50)));
  if (error) throw new Error(`Notification queue could not be read: ${error.code}`);

  let sent = 0;
  let failed = 0;
  let persistenceErrors = 0;
  const campaignIds = new Set<string>();
  const candidates = data as NotificationRow[];
  for (const candidate of candidates) {
    if (typeof candidate.payload.campaignId === "string") campaignIds.add(candidate.payload.campaignId);
  }
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < candidates.length) {
      const candidateIndex = nextIndex;
      nextIndex += 1;
      const candidate = candidates[candidateIndex];
      const { data: claimed, error: claimError } = await client
        .from("notifications")
        .update({ status: "processing", attempts: candidate.attempts + 1 })
        .eq("id", candidate.id)
        .in("status", ["pending", "failed"])
        .select("id")
        .maybeSingle();
      if (claimError) {
        persistenceErrors += 1;
      } else if (claimed) {
        try {
          const content = candidate.order_id
            ? await buildOrderEmail(candidate)
            : buildGeneralEmail(candidate);
          if (candidate.kind === "newsletter_campaign") {
            // Consent can change after a campaign is queued. Check again at
            // delivery time; a failed lookup must never authorize marketing.
            const { data: subscriber, error: consentError } = await client
              .from("newsletter_subscribers")
              .select("status")
              .eq("email", candidate.recipient_email.trim().toLowerCase())
              .maybeSingle();
            if (consentError) throw new Error("Newsletter consent could not be verified");
            if (subscriber?.status !== "subscribed") {
              const { error: suppressionError } = await client
                .from("notifications")
                .update({
                  status: "failed",
                  attempts: 5,
                  last_error: "Envoi annulé : consentement à l’infolettre absent ou retiré.",
                })
                .eq("id", candidate.id);
              if (suppressionError) {
                persistenceErrors += 1;
                throw new Error("Newsletter cancellation could not be saved");
              }
              failed += 1;
              continue;
            }
          }
          await sendEmail(candidate, content);
          const { error: sentError } = await client
            .from("notifications")
            .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
            .eq("id", candidate.id);
          if (sentError) throw new Error(`Notification completion failed: ${sentError.code}`);
          sent += 1;
        } catch (caught) {
          const nextDelayMinutes = Math.min(360, 5 * 2 ** candidate.attempts);
          const { error: retryError } = await client
            .from("notifications")
            .update({
              status: "failed",
              last_error:
                caught instanceof Error ? caught.message.slice(0, 400) : "Unknown notification error",
              scheduled_at: new Date(Date.now() + nextDelayMinutes * 60_000).toISOString(),
            })
            .eq("id", candidate.id);
          if (retryError) persistenceErrors += 1;
          failed += 1;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, candidates.length) }, () => worker()));
  for (const campaignId of campaignIds) {
    const { data: deliveries, error: deliveryError } = await client
      .from("notifications")
      .select("status, attempts")
      .eq("kind", "newsletter_campaign")
      .contains("payload", { campaignId });
    if (deliveryError) {
      persistenceErrors += 1;
      continue;
    }
    if (!deliveries?.length) continue;
    const allSent = deliveries.every((delivery) => delivery.status === "sent");
    const terminalFailure = deliveries.some(
      (delivery) => delivery.status === "failed" && delivery.attempts >= 5,
    );
    const { error: campaignError } = await client
      .from("marketing_campaigns")
      .update({ status: allSent ? "sent" : terminalFailure ? "failed" : "queued" })
      .eq("id", campaignId);
    if (campaignError) persistenceErrors += 1;
  }
  return { sent, failed, persistenceErrors };
}

export async function enqueueLowStockAlert() {
  const recipientEmail = process.env.ORDERS_TO_EMAIL;
  if (!recipientEmail) return false;
  const items = await listLowStockVariants(commerceSettings.lowStockThreshold);
  if (!items.length) return false;
  await enqueueNotification({
    kind: "low_stock",
    recipientEmail,
    payload: { items },
    dedupeKey: `low-stock-${new Date().toISOString().slice(0, 10)}`,
  });
  return true;
}

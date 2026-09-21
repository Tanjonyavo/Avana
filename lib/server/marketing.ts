import "server-only";

import { absoluteUrl } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { createUnsubscribeToken, hashSubscriberToken } from "@/lib/server/subscriber-tokens";
import type { AdminMarketingData } from "@/types/commerce";

interface CampaignInput {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  actionLabel: string;
  actionUrl?: string;
}

export async function getAdminMarketingData(): Promise<AdminMarketingData> {
  const client = getSupabaseAdmin();
  const [subscribers, campaigns, deliveries] = await Promise.all([
    client.from("newsletter_subscribers").select("status"),
    client
      .from("marketing_campaigns")
      .select("id, subject, status, recipient_count, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("notifications")
      .select("status, payload")
      .eq("kind", "newsletter_campaign")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  const error = subscribers.error || campaigns.error || deliveries.error;
  if (error) throw new Error(`Marketing data could not be loaded: ${error.code}`);
  const deliveryRows = (deliveries.data || []) as Array<{ status: string; payload: Record<string, unknown> }>;
  return {
    subscribed: (subscribers.data || []).filter((row) => row.status === "subscribed").length,
    pending: (subscribers.data || []).filter((row) => row.status === "pending").length,
    unsubscribed: (subscribers.data || []).filter((row) => row.status === "unsubscribed").length,
    campaigns: (campaigns.data || []).map((campaign) => {
      const matching = deliveryRows.filter((row) => row.payload?.campaignId === campaign.id);
      return {
        id: campaign.id,
        subject: campaign.subject,
        status: matching.length && matching.every((row) => row.status === "sent") ? "sent" : campaign.status,
        recipientCount: campaign.recipient_count,
        sentCount: matching.filter((row) => row.status === "sent").length,
        failedCount: matching.filter((row) => row.status === "failed").length,
        createdAt: campaign.created_at,
      };
    }),
  };
}

export async function queueNewsletterCampaign(input: CampaignInput) {
  const client = getSupabaseAdmin();
  const { data: subscribers, error: subscriberError } = await client
    .from("newsletter_subscribers")
    .select("email, unsubscribe_token_hash")
    .eq("status", "subscribed")
    .limit(5000);
  if (subscriberError) throw new Error(`Subscribers could not be loaded: ${subscriberError.code}`);
  if (!subscribers?.length) throw new Error("Aucun abonné confirmé.");

  const { data: campaign, error: campaignError } = await client
    .from("marketing_campaigns")
    .insert({
      subject: input.subject,
      preheader: input.preheader,
      heading: input.heading,
      body: input.body,
      action_label: input.actionLabel,
      action_url: input.actionUrl || "",
      status: "queued",
      recipient_count: subscribers.length,
    })
    .select("id")
    .single();
  if (campaignError) throw new Error(`Campaign could not be created: ${campaignError.code}`);

  try {
    const tokenized = subscribers.map((subscriber) => ({
      ...subscriber,
      unsubscribe: createUnsubscribeToken(subscriber.email),
    }));
    const stale = tokenized.filter(
      (subscriber) => subscriber.unsubscribe_token_hash !== subscriber.unsubscribe.hash,
    );
    for (let index = 0; index < stale.length; index += 25) {
      await Promise.all(
        stale.slice(index, index + 25).map(async (subscriber) => {
          const { error } = await client
            .from("newsletter_subscribers")
            .update({ unsubscribe_token_hash: subscriber.unsubscribe.hash })
            .eq("email", subscriber.email);
          if (error) throw new Error(`Unsubscribe token could not be rotated: ${error.code}`);
        }),
      );
    }
    const recipients = tokenized.map((subscriber) => ({
      recipient_email: subscriber.email,
      kind: "newsletter_campaign",
      dedupe_key: `campaign-${campaign.id}-${hashSubscriberToken(subscriber.email).slice(0, 24)}`,
      payload: {
        campaignId: campaign.id,
        subject: input.subject,
        preheader: input.preheader,
        heading: input.heading,
        body: input.body,
        actionLabel: input.actionLabel,
        actionUrl: input.actionUrl || "",
        unsubscribeUrl: absoluteUrl(
          `/api/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribe.token)}`,
        ),
      },
    }));
    for (let index = 0; index < recipients.length; index += 500) {
      const { error: queueError } = await client
        .from("notifications")
        .insert(recipients.slice(index, index + 500));
      if (queueError) throw new Error(`Campaign could not be queued: ${queueError.code}`);
    }
    return { id: campaign.id as string, recipientCount: recipients.length };
  } catch (caught) {
    await client
      .from("notifications")
      .delete()
      .eq("kind", "newsletter_campaign")
      .contains("payload", { campaignId: campaign.id });
    await client.from("marketing_campaigns").update({ status: "failed" }).eq("id", campaign.id);
    throw caught;
  }
}

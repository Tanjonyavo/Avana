import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { isEmailConfigured } from "@/lib/server/config";
import { queueNewsletterCampaign } from "@/lib/server/marketing";
import { processPendingNotifications } from "@/lib/server/notifications";
import { recordAuditLog } from "@/lib/server/orders";
import { adminCampaignSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request, true)))
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (!isEmailConfigured())
    return NextResponse.json({ error: "Resend n’est pas configuré." }, { status: 503 });
  const parsed = adminCampaignSchema.safeParse(await readJsonBody(request, 16_000).catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Vérifiez le contenu et confirmez l’envoi." }, { status: 400 });
  try {
    const campaign = await queueNewsletterCampaign(parsed.data);
    await recordAuditLog({
      action: "newsletter.queued",
      entityType: "marketing_campaign",
      entityId: campaign.id,
      metadata: { recipientCount: campaign.recipientCount },
    });
    await processPendingNotifications(10);
    return NextResponse.json({ ok: true, ...campaign }, { status: 202 });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Campagne impossible." },
      { status: 500 },
    );
  }
}

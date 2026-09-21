import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseAdminConfigured, isSupabaseAuthConfigured } from "@/lib/server/config";
import { updateCustomerProfile } from "@/lib/server/customer-account";
import { rateLimit } from "@/lib/server/rate-limit";
import { hasValidOrigin } from "@/lib/server/request";
import { readJsonBody } from "@/lib/server/request-body";
import { getCurrentUser } from "@/lib/supabase/server";
import { customerProfileSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest) {
  if (!hasValidOrigin(request))
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  if (!isSupabaseAdminConfigured() || !isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Le compte n’est pas configuré." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user?.email) return NextResponse.json({ error: "Reconnectez-vous pour continuer." }, { status: 401 });
  if (!(await rateLimit("account-profile", user.id, 20, 15 * 60))) {
    return NextResponse.json({ error: "Trop de modifications. Réessayez plus tard." }, { status: 429 });
  }
  const parsed = customerProfileSchema.safeParse(await readJsonBody(request, 8_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez vos coordonnées." }, { status: 400 });
  try {
    await updateCustomerProfile(user.id, user.email, parsed.data);
    revalidatePath("/compte");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Vos préférences n’ont pas pu être enregistrées." }, { status: 502 });
  }
}

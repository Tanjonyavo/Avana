import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseAdminConfigured, isSupabaseAuthConfigured } from "@/lib/server/config";
import { createCustomerAddress } from "@/lib/server/customer-account";
import { rateLimit } from "@/lib/server/rate-limit";
import { hasValidOrigin } from "@/lib/server/request";
import { readJsonBody } from "@/lib/server/request-body";
import { getCurrentUser } from "@/lib/supabase/server";
import { customerAddressSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request))
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  if (!isSupabaseAdminConfigured() || !isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Le compte n’est pas configuré." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Reconnectez-vous pour continuer." }, { status: 401 });
  if (!(await rateLimit("account-address", user.id, 30, 15 * 60))) {
    return NextResponse.json({ error: "Trop de modifications. Réessayez plus tard." }, { status: 429 });
  }
  const parsed = customerAddressSchema.safeParse(await readJsonBody(request, 16_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez l’adresse." }, { status: 400 });
  try {
    const id = await createCustomerAddress(user.id, parsed.data);
    revalidatePath("/compte");
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (caught) {
    const limitReached = caught instanceof Error && caught.message.includes("ADDRESS_LIMIT_REACHED");
    return NextResponse.json(
      {
        error: limitReached
          ? "Vous pouvez enregistrer jusqu’à 10 adresses."
          : "L’adresse n’a pas pu être enregistrée.",
      },
      { status: limitReached ? 409 : 502 },
    );
  }
}

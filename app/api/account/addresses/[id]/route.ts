import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseAdminConfigured, isSupabaseAuthConfigured } from "@/lib/server/config";
import { deleteCustomerAddress, updateCustomerAddress } from "@/lib/server/customer-account";
import { rateLimit } from "@/lib/server/rate-limit";
import { hasValidOrigin } from "@/lib/server/request";
import { readJsonBody } from "@/lib/server/request-body";
import { getCurrentUser } from "@/lib/supabase/server";
import { customerAddressSchema } from "@/lib/validation";

async function authorize(request: NextRequest, id: string) {
  if (!hasValidOrigin(request) || !z.string().uuid().safeParse(id).success) return null;
  if (!isSupabaseAdminConfigured() || !isSupabaseAuthConfigured()) return null;
  const user = await getCurrentUser();
  if (!user || !(await rateLimit("account-address", user.id, 30, 15 * 60))) return null;
  return user;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await authorize(request, id);
  if (!user) return NextResponse.json({ error: "Action non autorisée." }, { status: 401 });
  const parsed = customerAddressSchema.safeParse(await readJsonBody(request, 16_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez l’adresse." }, { status: 400 });
  try {
    const updated = await updateCustomerAddress(user.id, id, parsed.data);
    if (!updated) return NextResponse.json({ error: "Adresse introuvable." }, { status: 404 });
    revalidatePath("/compte");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "L’adresse n’a pas pu être modifiée." }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await authorize(request, id);
  if (!user) return NextResponse.json({ error: "Action non autorisée." }, { status: 401 });
  try {
    const deleted = await deleteCustomerAddress(user.id, id);
    if (!deleted) return NextResponse.json({ error: "Adresse introuvable." }, { status: 404 });
    revalidatePath("/compte");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "L’adresse n’a pas pu être supprimée." }, { status: 502 });
  }
}

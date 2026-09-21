import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { adminVariantUpdateSchema } from "@/lib/validation";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { updateAdminVariant } from "@/lib/server/admin-products";
import { recordAuditLog } from "@/lib/server/orders";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const parsed = adminVariantUpdateSchema.safeParse(await readJsonBody(request, 16_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez les champs du format." }, { status: 400 });
  const { id } = await context.params;
  try {
    const updated = await updateAdminVariant(id, parsed.data);
    if (!updated) return NextResponse.json({ error: "Format introuvable." }, { status: 404 });
    await recordAuditLog({
      action: "variant.updated",
      entityType: "variant",
      entityId: id,
      metadata: parsed.data,
    });
    revalidatePath("/", "layout");
    revalidatePath("/boutique");
    return NextResponse.json({ ok: true });
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "";
    const message = /duplicate|unique/i.test(reason)
      ? "Ce SKU existe déjà."
      : reason.includes("STOCK_BELOW_RESERVED")
        ? "Le stock physique ne peut pas être inférieur au stock réservé."
        : "Modification impossible.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

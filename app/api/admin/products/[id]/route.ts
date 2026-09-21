import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { adminProductUpdateSchema } from "@/lib/validation";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { updateAdminProduct } from "@/lib/server/admin-products";
import { recordAuditLog } from "@/lib/server/orders";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const parsed = adminProductUpdateSchema.safeParse(await readJsonBody(request, 32_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Valeurs invalides." }, { status: 400 });
  const { id } = await context.params;
  try {
    const updated = await updateAdminProduct(id, parsed.data);
    if (!updated) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    await recordAuditLog({
      action: "product.updated",
      entityType: "product",
      entityId: id,
      metadata: { active: parsed.data.active, status: parsed.data.status },
    });
    revalidatePath("/", "layout");
    revalidatePath("/boutique");
    revalidatePath(`/boutique/${parsed.data.slug}`);
    return NextResponse.json({ ok: true });
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "";
    const message = reason.includes("PRODUCT_LOT_NOT_FOUND")
      ? "Le lot choisi est introuvable ou archivé."
      : /duplicate|unique/i.test(reason)
        ? "Ce slug est déjà utilisé."
        : "Le produit n’a pas pu être modifié.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { createAdminVariant } from "@/lib/server/admin-products";
import { recordAuditLog } from "@/lib/server/orders";
import { adminVariantCreateSchema } from "@/lib/validation";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const parsed = adminVariantCreateSchema.safeParse(await readJsonBody(request, 16_000).catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vérifiez les champs du format." }, { status: 400 });
  }
  const { id } = await context.params;
  try {
    const variantId = await createAdminVariant(id, parsed.data);
    if (!variantId) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    await recordAuditLog({
      action: "variant.created",
      entityType: "variant",
      entityId: variantId,
      metadata: { productId: id },
    });
    revalidatePath("/", "layout");
    revalidatePath("/boutique");
    return NextResponse.json({ ok: true, variantId }, { status: 201 });
  } catch (caught) {
    const message =
      caught instanceof Error && /duplicate|unique/i.test(caught.message)
        ? "Ce SKU existe déjà."
        : "Le format n’a pas pu être créé.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

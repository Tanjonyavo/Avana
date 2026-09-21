import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { adminProductCreateSchema } from "@/lib/validation";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { createAdminProduct } from "@/lib/server/admin-products";
import { recordAuditLog } from "@/lib/server/orders";

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const parsed = adminProductCreateSchema.safeParse(await readJsonBody(request, 32_000).catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vérifiez tous les champs du produit.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  try {
    const created = await createAdminProduct(parsed.data);
    await recordAuditLog({ action: "product.created", entityType: "product", entityId: created.productId });
    revalidatePath("/", "layout");
    revalidatePath("/boutique");
    return NextResponse.json({ ok: true, ...created }, { status: 201 });
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "";
    const message = reason.includes("PRODUCT_LOT_NOT_FOUND")
      ? "Créez d’abord ce lot dans la section Lots."
      : /duplicate|unique/i.test(reason)
        ? "Ce slug ou ce SKU existe déjà."
        : "Le produit n’a pas pu être créé.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

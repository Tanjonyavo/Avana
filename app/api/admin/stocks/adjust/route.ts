import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { adjustInventory } from "@/lib/server/inventory";
import { recordAuditLog } from "@/lib/server/orders";
import { adminInventoryAdjustmentSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const parsed = adminInventoryAdjustmentSchema.safeParse(
    await readJsonBody(request, 8_000).catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "Vérifiez le mouvement de stock." }, { status: 400 });
  try {
    const stockOnHand = await adjustInventory(parsed.data);
    await recordAuditLog({
      action: "stock.adjusted",
      entityType: "variant",
      entityId: parsed.data.variantId,
      metadata: { reason: parsed.data.reason, quantity: parsed.data.quantity, stockOnHand },
    });
    revalidatePath("/", "layout");
    revalidatePath("/boutique");
    revalidatePath("/admin/stocks");
    return NextResponse.json({ ok: true, stockOnHand });
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "";
    const error = reason.includes("STOCK_BELOW_RESERVED")
      ? "Le mouvement ferait passer le stock sous la quantité réservée."
      : "Le stock n’a pas pu être ajusté.";
    return NextResponse.json({ error }, { status: 409 });
  }
}

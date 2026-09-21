import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { archiveAdminLot, updateAdminLot } from "@/lib/server/lots";
import { recordAuditLog } from "@/lib/server/orders";
import { adminLotUpdateSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const parsed = adminLotUpdateSchema.safeParse(await readJsonBody(request, 64_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez les données du lot." }, { status: 400 });
  const { id } = await context.params;
  try {
    if (!(await updateAdminLot(id, parsed.data)))
      return NextResponse.json({ error: "Lot introuvable." }, { status: 404 });
    await recordAuditLog({ action: "lot.updated", entityType: "lot", entityId: id });
    revalidatePath("/", "layout");
    revalidatePath("/tracabilite");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Le lot n’a pas pu être modifié." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    if (!(await archiveAdminLot(id)))
      return NextResponse.json({ error: "Lot introuvable." }, { status: 404 });
    await recordAuditLog({ action: "lot.archived", entityType: "lot", entityId: id });
    revalidatePath("/", "layout");
    revalidatePath("/tracabilite");
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Archivage impossible." },
      { status: 409 },
    );
  }
}

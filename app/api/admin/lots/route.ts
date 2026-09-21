import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { createAdminLot } from "@/lib/server/lots";
import { recordAuditLog } from "@/lib/server/orders";
import { adminLotCreateSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const parsed = adminLotCreateSchema.safeParse(await readJsonBody(request, 64_000).catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vérifiez les données du lot.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  try {
    const id = await createAdminLot(parsed.data);
    await recordAuditLog({
      action: "lot.created",
      entityType: "lot",
      entityId: id,
      metadata: { code: parsed.data.code },
    });
    revalidatePath("/", "layout");
    revalidatePath("/tracabilite");
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (caught) {
    const duplicate = caught instanceof Error && /duplicate|unique/i.test(caught.message);
    return NextResponse.json(
      { error: duplicate ? "Ce code de lot existe déjà." : "Le lot n’a pas pu être créé." },
      { status: duplicate ? 409 : 500 },
    );
  }
}

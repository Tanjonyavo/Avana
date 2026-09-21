import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import { assertOperationModule, createOperationalRecord } from "@/lib/server/operations";
import { recordAuditLog } from "@/lib/server/orders";
import { adminOperationalRecordSchema } from "@/lib/validation";

export async function POST(request: NextRequest, context: { params: Promise<{ module: string }> }) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const parsed = adminOperationalRecordSchema.safeParse(
    await readJsonBody(request, 32_000).catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "Vérifiez les champs du dossier." }, { status: 400 });
  try {
    const operationModule = assertOperationModule((await context.params).module);
    const id = await createOperationalRecord(operationModule, parsed.data);
    await recordAuditLog({
      action: `${operationModule}.created`,
      entityType: "operational_record",
      entityId: id,
    });
    revalidatePath(`/admin/${operationModule}`);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "";
    const error =
      reason === "MISSING_OPERATION_FIELD"
        ? "Complétez tous les champs requis."
        : reason === "INVALID_OPERATION_NUMBER"
          ? "Les nombres doivent être positifs."
          : "Le dossier n’a pas pu être créé.";
    return NextResponse.json({ error }, { status: 400 });
  }
}

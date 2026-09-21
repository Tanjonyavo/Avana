import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { readJsonBody } from "@/lib/server/request-body";
import {
  archiveOperationalRecord,
  assertOperationModule,
  updateOperationalRecord,
} from "@/lib/server/operations";
import { recordAuditLog } from "@/lib/server/orders";
import { adminOperationalRecordSchema } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ module: string; id: string }> },
) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const parsed = adminOperationalRecordSchema.safeParse(
    await readJsonBody(request, 32_000).catch(() => null),
  );
  const params = await context.params;
  if (!parsed.success || !z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Dossier invalide." }, { status: 400 });
  }
  try {
    const operationModule = assertOperationModule(params.module);
    const updated = await updateOperationalRecord(operationModule, params.id, parsed.data);
    if (!updated) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
    await recordAuditLog({
      action: `${operationModule}.updated`,
      entityType: "operational_record",
      entityId: params.id,
      metadata: { status: parsed.data.status },
    });
    revalidatePath(`/admin/${operationModule}`);
    return NextResponse.json({ ok: true });
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "";
    const error =
      reason === "MISSING_OPERATION_FIELD"
        ? "Complétez tous les champs requis."
        : reason === "INVALID_OPERATION_NUMBER"
          ? "Les nombres doivent être positifs."
          : "Le dossier n’a pas pu être modifié.";
    return NextResponse.json({ error }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ module: string; id: string }> },
) {
  if (!(await isAuthorizedAdminRequest(request, true))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const params = await context.params;
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Dossier invalide." }, { status: 400 });
  }
  try {
    const operationModule = assertOperationModule(params.module);
    const archived = await archiveOperationalRecord(operationModule, params.id);
    if (!archived) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
    await recordAuditLog({
      action: `${operationModule}.archived`,
      entityType: "operational_record",
      entityId: params.id,
    });
    revalidatePath(`/admin/${operationModule}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Archivage impossible." }, { status: 400 });
  }
}

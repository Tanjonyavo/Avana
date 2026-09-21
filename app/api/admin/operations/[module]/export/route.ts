import { NextRequest, NextResponse } from "next/server";
import { operationModules } from "@/lib/operations";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { csvDocument } from "@/lib/server/csv";
import { assertOperationModule, getRecallImpacts, listOperationalRecords } from "@/lib/server/operations";
import { recordAuditLog } from "@/lib/server/orders";

export async function GET(request: NextRequest, context: { params: Promise<{ module: string }> }) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  try {
    const operationModule = assertOperationModule((await context.params).module);
    const config = operationModules[operationModule];
    const records = await listOperationalRecords(operationModule);
    const recallImpacts = operationModule === "rappels" ? await getRecallImpacts(records) : {};
    const impactHeaders =
      operationModule === "rappels" ? ["Unités concernées", "Commandes concernées", "Clients concernés"] : [];
    const rows = [
      [
        config.titleLabel,
        "Statut",
        ...config.fields.map((field) => field.label),
        ...impactHeaders,
        "Créé le",
        "Modifié le",
      ],
      ...records.map((record) => {
        const impact = recallImpacts[record.id];
        const impactValues =
          operationModule === "rappels"
            ? [impact?.affectedUnits || 0, impact?.affectedOrders || 0, impact?.affectedCustomers || 0]
            : [];
        return [
          record.title,
          record.status,
          ...config.fields.map((field) => record.data[field.key]),
          ...impactValues,
          record.createdAt,
          record.updatedAt,
        ];
      }),
    ];
    await recordAuditLog({
      action: `${operationModule}.exported`,
      entityType: "operational_record",
      entityId: "all",
      metadata: { count: records.length },
    });
    return new NextResponse(csvDocument(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="avana-${operationModule}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Module invalide." }, { status: 404 });
  }
}

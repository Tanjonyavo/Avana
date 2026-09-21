import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { csvDocument } from "@/lib/server/csv";
import { listAdminLots } from "@/lib/server/lots";
import { recordAuditLog } from "@/lib/server/orders";

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const lots = await listAdminLots();
  const rows = [
    [
      "Code",
      "Pays",
      "Région",
      "Espèce",
      "Grade",
      "Récolte",
      "Quantité kg",
      "Disponible kg",
      "Statut",
      "Public",
      "Donnée",
    ],
    ...lots.map((lot) => [
      lot.code,
      lot.country,
      lot.region,
      lot.species,
      lot.grade,
      lot.harvestYear,
      lot.quantityKg,
      lot.availableKg,
      lot.status,
      lot.publicTraceabilityEnabled,
      lot.dataStatus,
    ]),
  ];
  await recordAuditLog({
    action: "lots.exported",
    entityType: "lots",
    entityId: "all",
    metadata: { count: lots.length },
  });
  return new NextResponse(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="avana-lots-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

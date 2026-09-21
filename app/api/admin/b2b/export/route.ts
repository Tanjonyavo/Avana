import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { listB2BSubmissions } from "@/lib/server/admin-submissions";
import { csvDocument } from "@/lib/server/csv";
import { recordAuditLog } from "@/lib/server/orders";

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const leads = await listB2BSubmissions(1_000);
  const rows = [
    [
      "Reçu le",
      "Étape",
      "Entreprise",
      "Prénom",
      "Nom",
      "Courriel",
      "Téléphone",
      "Segment",
      "Province",
      "Produit",
      "Volume",
      "Fréquence",
      "Commentaire",
      "Notes internes",
    ],
    ...leads.map((lead) => [
      lead.receivedAt,
      lead.status,
      lead.company,
      lead.firstName,
      lead.lastName,
      lead.email,
      lead.phone,
      lead.segment,
      lead.province,
      lead.product,
      lead.volume,
      lead.frequency,
      lead.comment,
      lead.notes,
    ]),
  ];
  await recordAuditLog({
    action: "b2b.exported",
    entityType: "submission",
    entityId: "all",
    metadata: { count: leads.length },
  });
  return new NextResponse(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="avana-prospects-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

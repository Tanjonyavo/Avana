import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { csvDocument } from "@/lib/server/csv";
import { listAdminOrders, recordAuditLog } from "@/lib/server/orders";

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const orders = await listAdminOrders(250);
  const rows = [
    [
      "Commande",
      "Date",
      "Client",
      "Courriel",
      "Statut",
      "Paiement",
      "Livraison",
      "Sous-total",
      "Remises",
      "Taxes",
      "Frais",
      "Total",
      "Remboursé",
      "Net",
    ],
    ...orders.map((order) => [
      order.number,
      order.createdAt,
      order.customerName,
      order.email,
      order.status,
      order.paymentStatus,
      order.fulfillmentStatus,
      (order.subtotalCents / 100).toFixed(2),
      (order.discountCents / 100).toFixed(2),
      (order.taxCents / 100).toFixed(2),
      (order.shippingCents / 100).toFixed(2),
      (order.totalCents / 100).toFixed(2),
      (order.refundedCents / 100).toFixed(2),
      ((order.totalCents - order.refundedCents) / 100).toFixed(2),
    ]),
  ];
  const csv = csvDocument(rows);
  await recordAuditLog({
    action: "orders.exported",
    entityType: "orders",
    entityId: "all",
    metadata: { count: orders.length },
  });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="avana-commandes-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

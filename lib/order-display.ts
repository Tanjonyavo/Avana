import type { FulfillmentStatus, OrderStatus, PaymentStatus } from "@/types/commerce";

const orderLabels: Record<OrderStatus, string> = {
  pending_payment: "Paiement en attente",
  paid: "Payée",
  processing: "En préparation",
  fulfilled: "Expédiée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};

const paymentLabels: Record<PaymentStatus, string> = {
  pending: "En attente",
  paid: "Payé",
  failed: "Échoué",
  refunded: "Remboursé",
  partially_refunded: "Partiellement remboursé",
};

const fulfillmentLabels: Record<FulfillmentStatus, string> = {
  unfulfilled: "À préparer",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  returned: "Retournée",
};

export function orderStatusLabel(status: OrderStatus) {
  return orderLabels[status];
}

export function paymentStatusLabel(status: PaymentStatus) {
  return paymentLabels[status];
}

export function fulfillmentStatusLabel(status: FulfillmentStatus) {
  return fulfillmentLabels[status];
}

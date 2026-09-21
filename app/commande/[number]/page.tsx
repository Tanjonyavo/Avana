import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/order-confirmation";
import { COMMERCE_ENABLED } from "@/lib/site";
import { getPublicOrderByAccess, getPublicOrderForCustomer } from "@/lib/server/orders";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Confirmation de commande",
  robots: { index: false, follow: false },
};
export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { number } = await params;
  const orderNumber = number.trim().toUpperCase();
  const { token = "" } = await searchParams;
  const user = COMMERCE_ENABLED ? await getCurrentUser() : null;
  const order = COMMERCE_ENABLED
    ? user
      ? await getPublicOrderForCustomer(orderNumber, user.id)
      : token
        ? await getPublicOrderByAccess(orderNumber, token)
        : null
    : null;
  return (
    <OrderConfirmation
      orderNumber={orderNumber}
      live={COMMERCE_ENABLED}
      initialOrder={order}
      accessToken={token}
    />
  );
}

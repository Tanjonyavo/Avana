import type { Metadata } from "next";
import { CheckoutFlow } from "@/components/checkout-flow";
import { commerceSettings } from "@/lib/server/config";

export const metadata: Metadata = {
  title: "Paiement sécurisé",
  robots: { index: false, follow: false },
};
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ annulee?: string }>;
}) {
  const { annulee } = await searchParams;
  return (
    <CheckoutFlow
      cancelled={annulee === "1"}
      settings={{
        standardShippingPrice: commerceSettings.standardShippingCents / 100,
        expressShippingPrice: commerceSettings.expressShippingCents / 100,
        freeShippingThreshold: commerceSettings.freeShippingThresholdCents / 100,
        business: commerceSettings.business,
      }}
    />
  );
}

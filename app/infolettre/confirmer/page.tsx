import type { Metadata } from "next";
import { NewsletterConfirmation } from "@/components/newsletter-confirmation";

export const metadata: Metadata = {
  title: "Confirmer l’infolettre",
  robots: { index: false, follow: false },
};

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return <NewsletterConfirmation token={token} />;
}

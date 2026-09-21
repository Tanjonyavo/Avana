import type { Metadata } from "next";
import { NewsletterUnsubscribe } from "@/components/newsletter-unsubscribe";

export const metadata: Metadata = { title: "Désabonnement", robots: { index: false, follow: false } };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return <NewsletterUnsubscribe token={token} />;
}

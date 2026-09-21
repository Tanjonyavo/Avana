import type { Metadata } from "next";
import { CartPageContent } from "@/components/cart-page";

export const metadata: Metadata = { title: "Panier", robots: { index: false, follow: true } };
export default function CartPage() {
  return <CartPageContent />;
}

import type { CartItem, Product, ProductVariant } from "@/types";

export interface DetailedCartItem extends CartItem {
  product: Product;
  variant: ProductVariant;
}

export function getDetailedCart(cart: CartItem[], products: Product[]): DetailedCartItem[] {
  return cart.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
    return product && variant ? [{ ...item, product, variant }] : [];
  });
}

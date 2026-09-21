import type { CartItem } from "../types";
import { commerceConfig } from "../data/config";

export function addCartItem(
  cart: CartItem[],
  productId: string,
  variantId: string,
  quantity = 1,
): CartItem[] {
  const existing = cart.find((item) => item.productId === productId && item.variantId === variantId);
  if (!existing)
    return [...cart, { productId, variantId, quantity: Math.min(quantity, commerceConfig.maxCartQuantity) }];
  return cart.map((item) =>
    item === existing
      ? { ...item, quantity: Math.min(item.quantity + quantity, commerceConfig.maxCartQuantity) }
      : item,
  );
}

export function setCartItemQuantity(
  cart: CartItem[],
  productId: string,
  variantId: string,
  quantity: number,
): CartItem[] {
  if (quantity <= 0)
    return cart.filter((item) => !(item.productId === productId && item.variantId === variantId));
  return cart.map((item) =>
    item.productId === productId && item.variantId === variantId
      ? { ...item, quantity: Math.min(quantity, commerceConfig.maxCartQuantity) }
      : item,
  );
}

export function calculateOrderTotals(
  subtotal: number,
  shippingPrice: number,
  taxRate = commerceConfig.taxRate,
) {
  const taxable = subtotal + shippingPrice;
  const tax = taxable * taxRate;
  return { subtotal, shippingPrice, tax, total: taxable + tax };
}

export function isCanadianPostalCode(value: string) {
  return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(value.trim());
}

export function isPublicDemoLotCode(value: string) {
  return /^DEMO-MG-SAVA-\d{3}$/.test(value.trim().toUpperCase());
}

export function hasRequiredB2BFields(lead: Record<string, string>) {
  return Boolean(
    lead.firstName?.trim() &&
      lead.lastName?.trim() &&
      lead.company?.trim() &&
      lead.email?.includes("@") &&
      lead.segment?.trim(),
  );
}

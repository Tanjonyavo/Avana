import type { CartItem } from "@/types";
import type { StorageParser } from "@/lib/storage";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const cartStorageSchema: StorageParser<CartItem[]> = {
  safeParse(value) {
    if (!Array.isArray(value) || value.length > 100) return { success: false };
    const valid = value.every(
      (item) =>
        isRecord(item) &&
        typeof item.productId === "string" &&
        typeof item.variantId === "string" &&
        Number.isInteger(item.quantity) &&
        Number(item.quantity) >= 1 &&
        Number(item.quantity) <= 10,
    );
    if (!valid) return { success: false };
    return {
      success: true,
      data: value.map((item) => ({
        productId: String(item.productId),
        variantId: String(item.variantId),
        quantity: Number(item.quantity),
      })),
    };
  },
};

export const favoritesStorageSchema: StorageParser<string[]> = {
  safeParse(value) {
    if (!Array.isArray(value) || value.length > 100 || !value.every((item) => typeof item === "string")) {
      return { success: false };
    }
    return { success: true, data: [...new Set(value)] };
  },
};

import { describe, expect, it } from "vitest";
import {
  addCartItem,
  calculateOrderTotals,
  hasRequiredB2BFields,
  isCanadianPostalCode,
  isPublicDemoLotCode,
  setCartItemQuantity,
} from "../lib/commerce";

describe("panier", () => {
  it("ajoute une variante et fusionne les quantités", () => {
    const initial = addCartItem([], "demo-product", "demo-variant", 2);
    expect(addCartItem(initial, "demo-product", "demo-variant", 1)).toEqual([
      { productId: "demo-product", variantId: "demo-variant", quantity: 3 },
    ]);
  });

  it("retire une ligne lorsque la quantité atteint zéro", () => {
    const cart = [{ productId: "demo-product", variantId: "demo-variant", quantity: 1 }];
    expect(setCartItemQuantity(cart, "demo-product", "demo-variant", 0)).toEqual([]);
  });
});

describe("checkout", () => {
  it("calcule taxes et total à partir du sous-total et de la livraison", () => {
    const totals = calculateOrderTotals(50, 8);
    expect(totals.tax).toBeCloseTo(8.6855);
    expect(totals.total).toBeCloseTo(66.6855);
  });

  it("valide les codes postaux canadiens", () => {
    expect(isCanadianPostalCode("H2X 1Y4")).toBe(true);
    expect(isCanadianPostalCode("12345")).toBe(false);
  });
});

describe("traçabilité", () => {
  it("réserve les codes publics de démonstration au format explicite", () => {
    expect(isPublicDemoLotCode("DEMO-MG-SAVA-001")).toBe(true);
    expect(isPublicDemoLotCode("MG-SAVA-2027-001")).toBe(false);
  });
});

describe("formulaire B2B", () => {
  it("exige les champs de qualification essentiels", () => {
    expect(
      hasRequiredB2BFields({
        firstName: "Ada",
        lastName: "L.",
        company: "Atelier",
        email: "ada@atelier.ca",
        segment: "Pâtisserie",
      }),
    ).toBe(true);
    expect(
      hasRequiredB2BFields({
        firstName: "Ada",
        lastName: "",
        company: "Atelier",
        email: "ada@atelier.ca",
        segment: "Pâtisserie",
      }),
    ).toBe(false);
  });
});

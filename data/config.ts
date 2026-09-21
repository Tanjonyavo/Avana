export const provinces = [
  { code: "QC", name: "Québec" },
  { code: "ON", name: "Ontario" },
  { code: "NB", name: "Nouveau-Brunswick" },
  { code: "NS", name: "Nouvelle-Écosse" },
  { code: "PE", name: "Île-du-Prince-Édouard" },
  { code: "NL", name: "Terre-Neuve-et-Labrador" },
  { code: "MB", name: "Manitoba" },
  { code: "SK", name: "Saskatchewan" },
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "Colombie-Britannique" },
  { code: "YT", name: "Yukon" },
  { code: "NT", name: "Territoires du Nord-Ouest" },
  { code: "NU", name: "Nunavut" },
] as const;

export const commerceConfig = {
  taxRate: 0.14975,
  freeShippingThreshold: 60,
  standardShippingPrice: 8,
  expressShippingPrice: 16,
  maxCartQuantity: 10,
} as const;

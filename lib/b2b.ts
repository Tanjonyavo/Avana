export const b2bStages = [
  "Nouveau lead",
  "Contacté",
  "Échantillon",
  "Discussion",
  "Proposition",
  "Négociation",
  "Client",
  "Perdu",
] as const;

export interface B2BSubmission {
  id: string;
  status: (typeof b2bStages)[number];
  notes: string;
  receivedAt: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  segment: string;
  province: string;
  product: string;
  volume: string;
  frequency: string;
  comment: string;
}

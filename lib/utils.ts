export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value);

export const formatDate = (value: string) => {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : undefined,
  }).format(new Date(dateOnly ? `${value}T00:00:00Z` : value));
};

export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

// Display helpers.

// Cents (INTEGER) → "$1,234.56".
export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  });
}

// "in 3 days" / "today" / "tomorrow" / "in 12 days".
export function relativeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

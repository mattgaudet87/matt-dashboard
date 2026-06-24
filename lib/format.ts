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

// Today as a LOCAL-time ISO date string (YYYY-MM-DD). Use this on the client
// instead of new Date().toISOString().slice(0,10), which is UTC and rolls to
// the next day in the evening for negative-offset timezones (e.g. Eastern).
export function todayIso(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// "in 3 days" / "today" / "tomorrow" / "in 12 days".
export function relativeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

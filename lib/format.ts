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

// The app's home timezone. "Today", habit completions, and the daily streak all
// roll over at midnight here — regardless of where the server (UTC on Vercel) or
// the browser happens to be. Atlantic time; DST is handled automatically.
export const APP_TIME_ZONE = "America/Moncton";

// ISO date string (YYYY-MM-DD) for a given instant, in the app's home timezone.
// en-CA formats as YYYY-MM-DD; the timeZone option does the offset + DST math.
export function isoDateInAppTz(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Today as an ISO date string (YYYY-MM-DD) in the app's home timezone. Use this
// everywhere instead of new Date().toISOString().slice(0,10) (which is UTC).
export function todayIso(): string {
  return isoDateInAppTz(new Date());
}

// "in 3 days" / "today" / "tomorrow" / "in 12 days".
export function relativeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

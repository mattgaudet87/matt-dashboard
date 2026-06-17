// Shared domain logic used by both /api/today and the dedicated routes so the
// urgency, recurrence, and scoring rules stay in exactly one place.
import {
  addYears,
  differenceInCalendarDays,
  format,
  isBefore,
  parseISO,
} from "date-fns";

// Today as an ISO date string (YYYY-MM-DD), local time.
export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

// --- relationships --------------------------------------------------------
// overdue if days since last contact > frequency; soon if > frequency × 0.7.
export type RelationshipUrgency = "overdue" | "soon" | "good";

export function relationshipUrgency(
  daysSinceContact: number,
  frequencyDays: number,
): RelationshipUrgency {
  if (daysSinceContact > frequencyDays) return "overdue";
  if (daysSinceContact > frequencyDays * 0.7) return "soon";
  return "good";
}

// --- important dates ------------------------------------------------------
// urgent if within reminder offset; soon if within 30 days; else normal.
export type DateUrgency = "urgent" | "soon" | "normal";

export function dateUrgency(
  daysUntil: number,
  reminderOffsetDays: number,
): DateUrgency {
  if (daysUntil <= reminderOffsetDays) return "urgent";
  if (daysUntil <= 30) return "soon";
  return "normal";
}

// For a recurring date in the past, advance the year until it is today or
// later. Returns the (possibly unchanged) ISO date string.
export function advanceRecurringDate(
  eventDate: string,
  isRecurring: number | boolean,
  referenceIso: string = todayIso(),
): string {
  if (!isRecurring) return eventDate;
  const ref = parseISO(referenceIso);
  let d = parseISO(eventDate);
  while (isBefore(d, ref)) {
    d = addYears(d, 1);
  }
  return format(d, "yyyy-MM-dd");
}

// Whole calendar days from today to an ISO date (negative = in the past).
export function daysUntil(
  eventDate: string,
  referenceIso: string = todayIso(),
): number {
  return differenceInCalendarDays(parseISO(eventDate), parseISO(referenceIso));
}

// --- health score ---------------------------------------------------------
// Weekly 0–100: workouts ≤3 worth 20 each (max 60), health-habit completions
// worth 5 each (max 30), +10 if a 7-day streak is active.
export function computeHealthScore(input: {
  workoutsThisWeek: number;
  healthHabitCompletionsThisWeek: number;
  streakActive: boolean;
}): number {
  const workoutPts = Math.min(input.workoutsThisWeek, 3) * 20;
  const habitPts = Math.min(input.healthHabitCompletionsThisWeek * 5, 30);
  const streakPts = input.streakActive ? 10 : 0;
  return Math.min(workoutPts + habitPts + streakPts, 100);
}

// --- habit scheduling -----------------------------------------------------
// Whether a habit is "expected" on a given JS weekday (0 = Sun … 6 = Sat).
// daily → every day | weekdays → Mon–Fri | custom → frequencyDays JSON array.
export function isHabitExpectedOn(
  frequencyType: string,
  frequencyDays: string | null,
  weekday: number,
): boolean {
  if (frequencyType === "weekdays") return weekday >= 1 && weekday <= 5;
  if (frequencyType === "custom") {
    if (!frequencyDays) return false;
    try {
      const days = JSON.parse(frequencyDays) as number[];
      return Array.isArray(days) && days.includes(weekday);
    } catch {
      return false;
    }
  }
  // default: daily
  return true;
}

// Shared domain logic used by both /api/today and the dedicated routes so the
// urgency, recurrence, and scoring rules stay in exactly one place.
import {
  addDays,
  addYears,
  differenceInCalendarDays,
  format,
  getDay,
  isBefore,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";

// Today as an ISO date string (YYYY-MM-DD), local time.
export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

// --- relationships --------------------------------------------------------
// overdue if days since last contact > frequency; soon if > frequency × 0.7.
// "new" is assigned by callers when no contact has ever been logged.
export type RelationshipUrgency = "overdue" | "soon" | "good" | "new";

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

// --- global streak --------------------------------------------------------
// The stored streak_count only resets lazily, on the next XP award. Between
// actions it can be stale: if the last action was older than yesterday the
// streak has actually lapsed. This returns the streak as it should be *shown*
// — the stored count while still alive (acted today or yesterday), else 0.
export function effectiveStreak(
  streakCount: number,
  streakLastDate: string | null,
  referenceIso: string = todayIso(),
): number {
  if (!streakLastDate) return 0;
  const yesterday = format(subDays(parseISO(referenceIso), 1), "yyyy-MM-dd");
  if (streakLastDate === referenceIso || streakLastDate === yesterday) {
    return streakCount;
  }
  return 0;
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

// The seven ISO dates (Mon→Sun) of the calendar week containing `reference`.
// Used for the habit dot grids on both Today and the Habits page.
export function weekDates(reference: Date = new Date()): string[] {
  const start = startOfWeek(reference, { weekStartsOn: 1 }); // Monday
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(start, i), "yyyy-MM-dd"),
  );
}

// Status of a single day cell in a habit dot grid.
// future → after today | completed → logged | today → today, not yet logged |
// missed → past expected day with no log | empty → past day it wasn't expected.
export function habitCellStatus(
  date: string,
  today: string,
  completed: boolean,
  expected: boolean,
): "completed" | "today" | "missed" | "empty" | "future" {
  if (date > today) return "future";
  if (completed) return "completed";
  if (date === today) return "today";
  return expected ? "missed" : "empty";
}

// Current per-habit streak: consecutive *expected* days (walking back from today)
// that were completed. Today counts only if logged; an unlogged today does not
// break the streak (it's still pending). Capped to avoid runaway loops.
export function habitStreak(
  frequencyType: string,
  frequencyDays: string | null,
  completedDates: Set<string>,
  today: string = todayIso(),
): number {
  let streak = 0;
  let cursor = parseISO(today);
  for (let i = 0; i < 400; i++) {
    const iso = format(cursor, "yyyy-MM-dd");
    if (isHabitExpectedOn(frequencyType, frequencyDays, getDay(cursor))) {
      if (completedDates.has(iso)) {
        streak += 1;
      } else if (iso !== today) {
        break; // a past expected day with no log ends the streak
      }
      // unlogged today: pending, neither counts nor breaks
    }
    cursor = subDays(cursor, 1);
  }
  return streak;
}

// GET  /api/habits — active habits, each with this week's dot grid + streak.
// POST /api/habits — create a habit.
import { getDay, parseISO } from "date-fns";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import {
  habitCellStatus,
  habitStreak,
  isHabitExpectedOn,
  todayIso,
  weekDates,
} from "@/lib/domain";
import { habitLogs, habits } from "@/lib/schema";

const createHabitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(["health", "mindset", "relationships", "other"]).default("other"),
  frequencyType: z.enum(["daily", "weekdays", "custom"]).default("daily"),
  // Day numbers (0 = Sun … 6 = Sat); required+used only for custom.
  frequencyDays: z.array(z.number().int().min(0).max(6)).optional(),
});

export async function GET() {
  const today = todayIso();
  const week = weekDates();

  const [activeHabits, allLogs] = await Promise.all([
    db.select().from(habits).where(eq(habits.isActive, 1)).orderBy(asc(habits.createdAt)),
    db.select().from(habitLogs),
  ]);

  // habitId → set of logged ISO dates.
  const logsByHabit = new Map<number, Set<string>>();
  for (const log of allLogs) {
    let set = logsByHabit.get(log.habitId);
    if (!set) {
      set = new Set<string>();
      logsByHabit.set(log.habitId, set);
    }
    set.add(log.loggedDate);
  }

  const result = activeHabits.map((h) => {
    const logged = logsByHabit.get(h.id) ?? new Set<string>();
    const weekGrid = week.map((date) => {
      const weekday = getDay(parseISO(date));
      const expected = isHabitExpectedOn(h.frequencyType, h.frequencyDays, weekday);
      return { date, status: habitCellStatus(date, today, logged.has(date), expected) };
    });
    return {
      id: h.id,
      name: h.name,
      category: h.category,
      frequencyType: h.frequencyType,
      frequencyDays: h.frequencyDays,
      isActive: h.isActive,
      completedToday: logged.has(today),
      expectedToday: isHabitExpectedOn(h.frequencyType, h.frequencyDays, getDay(parseISO(today))),
      streak: habitStreak(h.frequencyType, h.frequencyDays, logged, today),
      week: weekGrid,
    };
  });

  return jsonOk({ today, weekDays: week, habits: result });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, createHabitSchema);
  if (!parsed.ok) return parsed.response;
  const { name, category, frequencyType, frequencyDays } = parsed.data;

  if (frequencyType === "custom" && (!frequencyDays || frequencyDays.length === 0)) {
    return jsonError("Custom habits need at least one day selected", 400);
  }

  // Persist custom day numbers as a JSON string; null for daily/weekdays.
  const daysJson =
    frequencyType === "custom" && frequencyDays
      ? JSON.stringify([...new Set(frequencyDays)].sort((a, b) => a - b))
      : null;

  const [habit] = await db
    .insert(habits)
    .values({ name, category, frequencyType, frequencyDays: daysJson })
    .returning();

  return jsonOk({ habit }, 201);
}

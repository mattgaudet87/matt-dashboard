// GET  /api/health/workout — recent workouts, weekly health score, 8-week chart.
// POST /api/health/workout — log a workout (+12 XP).
import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import { desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { jsonOk, parseBody } from "@/lib/api";
import { awardXp, XP_VALUES } from "@/lib/award-xp";
import { db } from "@/lib/db";
import { computeHealthScore, effectiveStreak, todayIso } from "@/lib/domain";
import { habitLogs, habits, users, workoutLogs } from "@/lib/schema";

export async function GET() {
  const today = todayIso();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekStartIso = format(weekStart, "yyyy-MM-dd");
  // Eight buckets back, oldest first.
  const windowStart = subWeeks(weekStart, 7);
  const windowStartIso = format(windowStart, "yyyy-MM-dd");

  const [user] = await db.select().from(users).where(eq(users.id, 1));
  const [allWorkouts, weekHabitLogs, activeHabits] = await Promise.all([
    db.select().from(workoutLogs).orderBy(desc(workoutLogs.workoutDate), desc(workoutLogs.id)),
    db.select().from(habitLogs).where(gte(habitLogs.loggedDate, weekStartIso)),
    db.select().from(habits).where(eq(habits.isActive, 1)),
  ]);

  // --- 8-week buckets (Mon-anchored) ---
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(windowStart, i * 7);
    return {
      weekStart: format(start, "yyyy-MM-dd"),
      end: format(addDays(start, 6), "yyyy-MM-dd"),
      workouts: 0,
      minutes: 0,
    };
  });
  for (const w of allWorkouts) {
    if (w.workoutDate < windowStartIso || w.workoutDate > today) continue;
    const bucket = weeks.find((b) => w.workoutDate >= b.weekStart && w.workoutDate <= b.end);
    if (bucket) {
      bucket.workouts += 1;
      bucket.minutes += w.durationMinutes ?? 0;
    }
  }

  // --- this-week summary + health score ---
  const thisWeek = weeks[weeks.length - 1];
  const healthHabitIds = new Set(
    activeHabits.filter((h) => h.category === "health").map((h) => h.id),
  );
  const healthHabitCompletions = weekHabitLogs.filter((l) => healthHabitIds.has(l.habitId)).length;
  // Use the lapse-aware streak (matches /api/today) so both screens show the
  // same Health Score — the raw stored streakCount can be stale.
  const streak = effectiveStreak(user?.streakCount ?? 0, user?.streakLastDate ?? null, today);
  const healthScore = computeHealthScore({
    workoutsThisWeek: thisWeek.workouts,
    healthHabitCompletionsThisWeek: healthHabitCompletions,
    streakActive: streak >= 7,
  });

  return jsonOk({
    today,
    healthScore,
    weekly: { workouts: thisWeek.workouts, minutes: thisWeek.minutes },
    weeks: weeks.map(({ weekStart, workouts, minutes }) => ({ weekStart, workouts, minutes })),
    recent: allWorkouts.slice(0, 15),
  });
}

const workoutSchema = z.object({
  workoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").optional(),
  type: z.enum(["run", "lift", "bike", "swim", "other"]).default("other"),
  durationMinutes: z.number().int().positive().nullish(),
  notes: z.string().max(1000).nullish(),
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, workoutSchema);
  if (!parsed.ok) return parsed.response;
  const { workoutDate, type, durationMinutes, notes } = parsed.data;

  const xp = XP_VALUES.workout;
  const [workout] = await db
    .insert(workoutLogs)
    .values({
      workoutDate: workoutDate ?? todayIso(),
      type,
      durationMinutes: durationMinutes ?? null,
      notes: notes ?? null,
      xpAwarded: xp,
    })
    .returning();

  const award = await awardXp("workout", xp, workout.id);

  return jsonOk({ workout, award }, 201);
}

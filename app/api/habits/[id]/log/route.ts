// POST /api/habits/[id]/log — log today's completion of a habit (+10 XP).
// Returns 409 if the habit was already logged today.
import { and, eq } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api";
import { awardXp, XP_VALUES } from "@/lib/award-xp";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/domain";
import { habitLogs, habits } from "@/lib/schema";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const habitId = Number(id);
  if (!Number.isInteger(habitId)) {
    return jsonError("Invalid habit id", 400);
  }

  const [habit] = await db.select().from(habits).where(eq(habits.id, habitId));
  if (!habit) {
    return jsonError("Habit not found", 404);
  }

  const loggedDate = todayIso();

  // Guard against double-logging the same habit on the same day.
  const [existing] = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.loggedDate, loggedDate)));
  if (existing) {
    return jsonError("Habit already logged today", 409);
  }

  const xp = XP_VALUES.habit;
  const [log] = await db
    .insert(habitLogs)
    .values({ habitId, loggedDate, xpAwarded: xp })
    .returning();

  const award = await awardXp("habit", xp, log.id);

  return jsonOk({ log, award }, 201);
}

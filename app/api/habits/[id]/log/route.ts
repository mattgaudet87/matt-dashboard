// POST /api/habits/[id]/log — log today's completion of a habit (+10 XP).
// Returns 409 if the habit was already logged today.
// DELETE /api/habits/[id]/log — undo TODAY's completion (−10 XP). Today only.
import { and, eq } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api";
import { awardXp, reverseXp, XP_VALUES } from "@/lib/award-xp";
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const habitId = Number(id);
  if (!Number.isInteger(habitId)) {
    return jsonError("Invalid habit id", 400);
  }

  const loggedDate = todayIso();

  // Only today's completion can be undone — never edit history.
  const [log] = await db
    .select()
    .from(habitLogs)
    .where(
      and(eq(habitLogs.habitId, habitId), eq(habitLogs.loggedDate, loggedDate)),
    );
  if (!log) {
    return jsonError("No completion logged today to undo", 404);
  }

  // Reverse the XP first (removes the matching xp_log row), then drop the log.
  const award = await reverseXp("habit", log.xpAwarded, log.id);
  await db.delete(habitLogs).where(eq(habitLogs.id, log.id));

  return jsonOk({ undone: true, award });
}

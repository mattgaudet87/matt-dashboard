// POST /api/health/workout — log a workout (+12 XP).
import { z } from "zod";
import { jsonOk, parseBody } from "@/lib/api";
import { awardXp, XP_VALUES } from "@/lib/award-xp";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/domain";
import { workoutLogs } from "@/lib/schema";

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

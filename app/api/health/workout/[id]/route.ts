// PATCH  /api/health/workout/[id] — edit a workout (date/type/duration/notes). No XP change.
// DELETE /api/health/workout/[id] — remove a workout (−12 XP reversed).
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { reverseXp } from "@/lib/award-xp";
import { db } from "@/lib/db";
import { workoutLogs } from "@/lib/schema";

const patchSchema = z
  .object({
    workoutDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
      .optional(),
    type: z.enum(["run", "lift", "bike", "swim", "other"]).optional(),
    durationMinutes: z.number().int().positive().nullish(),
    notes: z.string().max(1000).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workoutId = Number(id);
  if (!Number.isInteger(workoutId)) return jsonError("Invalid id", 400);

  const parsed = await parseBody(req, patchSchema);
  if (!parsed.ok) return parsed.response;

  const [workout] = await db
    .select()
    .from(workoutLogs)
    .where(eq(workoutLogs.id, workoutId));
  if (!workout) return jsonError("Workout not found", 404);

  const updates: Partial<typeof workoutLogs.$inferInsert> = {};
  if (parsed.data.workoutDate !== undefined) updates.workoutDate = parsed.data.workoutDate;
  if (parsed.data.type !== undefined) updates.type = parsed.data.type;
  if (parsed.data.durationMinutes !== undefined)
    updates.durationMinutes = parsed.data.durationMinutes ?? null;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes ?? null;

  const [updated] = await db
    .update(workoutLogs)
    .set(updates)
    .where(eq(workoutLogs.id, workoutId))
    .returning();

  return jsonOk({ workout: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workoutId = Number(id);
  if (!Number.isInteger(workoutId)) return jsonError("Invalid id", 400);

  const [workout] = await db
    .select()
    .from(workoutLogs)
    .where(eq(workoutLogs.id, workoutId));
  if (!workout) return jsonError("Workout not found", 404);

  // Reverse the XP this workout awarded (removes its xp_log row), then delete it.
  const award = await reverseXp("workout", workout.xpAwarded, workout.id);
  await db.delete(workoutLogs).where(eq(workoutLogs.id, workoutId));

  return jsonOk({ deleted: true, award });
}

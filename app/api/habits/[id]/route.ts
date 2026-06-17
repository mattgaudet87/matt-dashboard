// PATCH /api/habits/[id] — archive / unarchive a habit (history is preserved).
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { habits } from "@/lib/schema";

const patchSchema = z.object({
  isActive: z.union([z.literal(0), z.literal(1)]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const habitId = Number(id);
  if (!Number.isInteger(habitId)) return jsonError("Invalid habit id", 400);

  const parsed = await parseBody(req, patchSchema);
  if (!parsed.ok) return parsed.response;

  const [habit] = await db.select().from(habits).where(eq(habits.id, habitId));
  if (!habit) return jsonError("Habit not found", 404);

  const [updated] = await db
    .update(habits)
    .set({ isActive: parsed.data.isActive })
    .where(eq(habits.id, habitId))
    .returning();

  return jsonOk({ habit: updated });
}

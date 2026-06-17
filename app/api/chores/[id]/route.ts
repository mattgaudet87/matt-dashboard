// PATCH /api/chores/[id] — edit a chore and/or archive (logs are preserved).
// Marking a chore done lives at /api/chores/[id]/done.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { chores } from "@/lib/schema";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    frequencyDays: z.number().int().positive().optional(),
    nextDueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
      .optional(),
    isRepeating: z.union([z.literal(0), z.literal(1)]).optional(),
    notes: z.string().max(1000).nullish(),
    isActive: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const choreId = Number(id);
  if (!Number.isInteger(choreId)) return jsonError("Invalid chore id", 400);

  const parsed = await parseBody(req, patchSchema);
  if (!parsed.ok) return parsed.response;

  const [chore] = await db.select().from(chores).where(eq(chores.id, choreId));
  if (!chore) return jsonError("Chore not found", 404);

  const updates: Partial<typeof chores.$inferInsert> = {};
  const { name, frequencyDays, nextDueDate, isRepeating, notes, isActive } = parsed.data;
  if (name !== undefined) updates.name = name;
  if (frequencyDays !== undefined) updates.frequencyDays = frequencyDays;
  if (nextDueDate !== undefined) updates.nextDueDate = nextDueDate;
  if (isRepeating !== undefined) updates.isRepeating = isRepeating;
  if (notes !== undefined) updates.notes = notes;
  if (isActive !== undefined) updates.isActive = isActive;

  const [updated] = await db
    .update(chores)
    .set(updates)
    .where(eq(chores.id, choreId))
    .returning();

  return jsonOk({ chore: updated });
}

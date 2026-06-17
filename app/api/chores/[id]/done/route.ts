// PATCH /api/chores/[id]/done — mark a chore done (+8 XP).
// next_due_date advances by frequency_days FROM the completion date (not the
// old due date) to avoid catch-up backlog.
import { addDays, format, parseISO } from "date-fns";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { awardXp, reverseXp, XP_VALUES } from "@/lib/award-xp";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/domain";
import { choreLogs, chores } from "@/lib/schema";

// Body is optional; allows backdating the completion date.
const doneSchema = z
  .object({
    completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").optional(),
  })
  .nullish();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const choreId = Number(id);
  if (!Number.isInteger(choreId)) return jsonError("Invalid chore id", 400);

  // Body is optional — tolerate an empty request.
  let completedDate = todayIso();
  const text = await req.text();
  if (text.trim()) {
    const parsed = doneSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return jsonError("Validation failed", 400, parsed.error.flatten());
    }
    completedDate = parsed.data?.completedDate ?? completedDate;
  }

  const [chore] = await db.select().from(chores).where(eq(chores.id, choreId));
  if (!chore) return jsonError("Chore not found", 404);

  // Repeating chores advance the due date; one-off chores are archived instead.
  const setValues =
    chore.isRepeating === 0
      ? { isActive: 0 as const }
      : {
          nextDueDate: format(
            addDays(parseISO(completedDate), chore.frequencyDays),
            "yyyy-MM-dd",
          ),
        };

  const [updated] = await db
    .update(chores)
    .set(setValues)
    .where(eq(chores.id, choreId))
    .returning();

  const xp = XP_VALUES.chore;
  const [log] = await db
    .insert(choreLogs)
    .values({ choreId, completedDate, xpAwarded: xp })
    .returning();

  const award = await awardXp("chore", xp, log.id);

  return jsonOk({ chore: updated, log, award });
}

// DELETE /api/chores/[id]/done — undo the most recent completion: reverse its
// XP, remove the chore_log, and roll the chore back (repeating → due again on
// the undone completion date; one-off → un-archived).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const choreId = Number(id);
  if (!Number.isInteger(choreId)) return jsonError("Invalid chore id", 400);

  const [chore] = await db.select().from(chores).where(eq(chores.id, choreId));
  if (!chore) return jsonError("Chore not found", 404);

  const [log] = await db
    .select()
    .from(choreLogs)
    .where(eq(choreLogs.choreId, choreId))
    .orderBy(desc(choreLogs.id))
    .limit(1);
  if (!log) return jsonError("Nothing to undo for this chore", 404);

  const award = await reverseXp("chore", log.xpAwarded, log.id);
  await db.delete(choreLogs).where(eq(choreLogs.id, log.id));

  // Roll the chore back to its pre-completion state.
  const setValues =
    chore.isRepeating === 0
      ? { isActive: 1 as const }
      : { nextDueDate: log.completedDate };
  const [updated] = await db
    .update(chores)
    .set(setValues)
    .where(eq(chores.id, choreId))
    .returning();

  return jsonOk({ chore: updated, undone: true, award });
}

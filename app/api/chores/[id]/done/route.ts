// PATCH /api/chores/[id]/done — mark a chore done (+8 XP).
// next_due_date advances by frequency_days FROM the completion date (not the
// old due date) to avoid catch-up backlog.
import { addDays, format, parseISO } from "date-fns";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { awardXp, XP_VALUES } from "@/lib/award-xp";
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

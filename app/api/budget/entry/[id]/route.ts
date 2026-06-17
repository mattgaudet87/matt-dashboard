// PATCH  /api/budget/entry/[id] — edit an entry (amount/date/note). No XP change.
// DELETE /api/budget/entry/[id] — remove an entry; reverses +20 XP if it was a saving.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { reverseXp, XP_VALUES } from "@/lib/award-xp";
import { db } from "@/lib/db";
import { budgetEntries } from "@/lib/schema";

const patchSchema = z
  .object({
    amount: z.number().int().positive().optional(),
    entryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
      .optional(),
    note: z.string().max(500).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) return jsonError("Invalid id", 400);

  const parsed = await parseBody(req, patchSchema);
  if (!parsed.ok) return parsed.response;

  const [entry] = await db
    .select()
    .from(budgetEntries)
    .where(eq(budgetEntries.id, entryId));
  if (!entry) return jsonError("Entry not found", 404);

  const updates: Partial<typeof budgetEntries.$inferInsert> = {};
  if (parsed.data.amount !== undefined) updates.amount = parsed.data.amount;
  if (parsed.data.entryDate !== undefined) {
    updates.entryDate = parsed.data.entryDate;
    updates.yearMonth = parsed.data.entryDate.slice(0, 7);
  }
  if (parsed.data.note !== undefined) updates.note = parsed.data.note ?? null;

  const [updated] = await db
    .update(budgetEntries)
    .set(updates)
    .where(eq(budgetEntries.id, entryId))
    .returning();

  return jsonOk({ entry: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) return jsonError("Invalid id", 400);

  const [entry] = await db
    .select()
    .from(budgetEntries)
    .where(eq(budgetEntries.id, entryId));
  if (!entry) return jsonError("Entry not found", 404);

  // Savings contributions awarded +20 XP (ref = entry.id); spends awarded none.
  let award = null;
  if (entry.entryType === "saving") {
    award = await reverseXp("saving", XP_VALUES.saving, entry.id);
  }
  await db.delete(budgetEntries).where(eq(budgetEntries.id, entryId));

  return jsonOk({ deleted: true, award });
}

// PATCH  /api/people/[id]/contact/[logId] — edit a contact log (date/note). No XP change.
// DELETE /api/people/[id]/contact/[logId] — remove a contact log (−15 XP reversed).
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { reverseXp } from "@/lib/award-xp";
import { db } from "@/lib/db";
import { contactLogs } from "@/lib/schema";

const patchSchema = z
  .object({
    contactDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
      .optional(),
    note: z.string().max(1000).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

function parseIds(idStr: string, logIdStr: string) {
  const personId = Number(idStr);
  const logId = Number(logIdStr);
  if (!Number.isInteger(personId) || !Number.isInteger(logId)) return null;
  return { personId, logId };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; logId: string }> },
) {
  const { id, logId } = await params;
  const ids = parseIds(id, logId);
  if (!ids) return jsonError("Invalid id", 400);

  const parsed = await parseBody(req, patchSchema);
  if (!parsed.ok) return parsed.response;

  const [log] = await db
    .select()
    .from(contactLogs)
    .where(
      and(eq(contactLogs.id, ids.logId), eq(contactLogs.personId, ids.personId)),
    );
  if (!log) return jsonError("Contact log not found", 404);

  const updates: Partial<typeof contactLogs.$inferInsert> = {};
  if (parsed.data.contactDate !== undefined) updates.contactDate = parsed.data.contactDate;
  if (parsed.data.note !== undefined) updates.note = parsed.data.note ?? null;

  const [updated] = await db
    .update(contactLogs)
    .set(updates)
    .where(eq(contactLogs.id, ids.logId))
    .returning();

  return jsonOk({ log: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; logId: string }> },
) {
  const { id, logId } = await params;
  const ids = parseIds(id, logId);
  if (!ids) return jsonError("Invalid id", 400);

  const [log] = await db
    .select()
    .from(contactLogs)
    .where(
      and(eq(contactLogs.id, ids.logId), eq(contactLogs.personId, ids.personId)),
    );
  if (!log) return jsonError("Contact log not found", 404);

  // Reverse the XP this log awarded (removes its xp_log row), then delete it.
  const award = await reverseXp("contact", log.xpAwarded, log.id);
  await db.delete(contactLogs).where(eq(contactLogs.id, ids.logId));

  return jsonOk({ deleted: true, award });
}

// PATCH /api/dates/[id] — edit an important date and/or dismiss (archive).
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { importantDates } from "@/lib/schema";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").optional(),
    type: z
      .enum(["birthday", "anniversary", "renewal", "event", "reminder"])
      .optional(),
    isRecurring: z.union([z.literal(0), z.literal(1)]).optional(),
    reminderOffsetDays: z.number().int().nonnegative().optional(),
    isActive: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dateId = Number(id);
  if (!Number.isInteger(dateId)) return jsonError("Invalid date id", 400);

  const parsed = await parseBody(req, patchSchema);
  if (!parsed.ok) return parsed.response;

  const [date] = await db
    .select()
    .from(importantDates)
    .where(eq(importantDates.id, dateId));
  if (!date) return jsonError("Date not found", 404);

  const updates: Partial<typeof importantDates.$inferInsert> = {};
  const { title, eventDate, type, isRecurring, reminderOffsetDays, isActive } = parsed.data;
  if (title !== undefined) updates.title = title;
  if (eventDate !== undefined) updates.eventDate = eventDate;
  if (type !== undefined) updates.type = type;
  if (isRecurring !== undefined) updates.isRecurring = isRecurring;
  if (reminderOffsetDays !== undefined) updates.reminderOffsetDays = reminderOffsetDays;
  if (isActive !== undefined) updates.isActive = isActive;

  const [updated] = await db
    .update(importantDates)
    .set(updates)
    .where(eq(importantDates.id, dateId))
    .returning();

  return jsonOk({ date: updated });
}

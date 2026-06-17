// GET /api/dates  — active important dates with urgency. Recurring dates that
//   have passed are advanced a year (persisted); past one-time dates go inactive.
// POST /api/dates — add an important date.
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { jsonOk, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { advanceRecurringDate, dateUrgency, daysUntil, todayIso } from "@/lib/domain";
import { importantDates } from "@/lib/schema";

const createDateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  type: z
    .enum(["birthday", "anniversary", "renewal", "event", "reminder"])
    .default("event"),
  isRecurring: z.union([z.boolean(), z.literal(0), z.literal(1)]).default(false),
  reminderOffsetDays: z.number().int().nonnegative().default(7),
  personId: z.number().int().positive().nullish(),
});

export async function GET() {
  const today = todayIso();
  const rows = await db
    .select()
    .from(importantDates)
    .where(eq(importantDates.isActive, 1))
    .orderBy(asc(importantDates.eventDate));

  const result = [];
  for (const d of rows) {
    let eventDate = d.eventDate;

    if (d.isRecurring) {
      const advanced = advanceRecurringDate(eventDate, true, today);
      if (advanced !== eventDate) {
        eventDate = advanced;
        await db
          .update(importantDates)
          .set({ eventDate })
          .where(eq(importantDates.id, d.id));
      }
    } else if (eventDate < today) {
      // Past one-time date → deactivate, skip from results.
      await db
        .update(importantDates)
        .set({ isActive: 0 })
        .where(eq(importantDates.id, d.id));
      continue;
    }

    const days = daysUntil(eventDate, today);
    result.push({
      ...d,
      eventDate,
      daysUntil: days,
      urgency: dateUrgency(days, d.reminderOffsetDays),
    });
  }

  // Re-sort by the (possibly advanced) event dates.
  result.sort((a, b) => a.daysUntil - b.daysUntil);

  return jsonOk({ dates: result });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, createDateSchema);
  if (!parsed.ok) return parsed.response;
  const { title, eventDate, type, isRecurring, reminderOffsetDays, personId } =
    parsed.data;

  const [date] = await db
    .insert(importantDates)
    .values({
      title,
      eventDate,
      type,
      isRecurring: isRecurring ? 1 : 0,
      reminderOffsetDays,
      personId: personId ?? null,
    })
    .returning();

  return jsonOk({ date }, 201);
}

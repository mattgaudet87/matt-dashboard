// GET /api/people  — active people with computed check-in urgency.
// POST /api/people — add a person; a birthday auto-creates an important_dates row.
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { jsonOk, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { relationshipUrgency, todayIso } from "@/lib/domain";
import { contactLogs, importantDates, people } from "@/lib/schema";
import { differenceInCalendarDays, parseISO } from "date-fns";

const createPersonSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relationshipType: z
    .enum(["family", "friend", "partner", "mentor", "other"])
    .default("friend"),
  checkinFrequencyDays: z.number().int().positive().default(30),
  notes: z.string().max(2000).nullish(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").nullish(),
  whenMet: z.string().max(2000).nullish(),
  howMet: z.string().max(2000).nullish(),
  sharedInterests: z.string().max(2000).nullish(),
});

export async function GET() {
  const active = await db
    .select()
    .from(people)
    .where(eq(people.isActive, 1))
    .orderBy(desc(people.createdAt));

  const logs = await db.select().from(contactLogs);

  // Latest contact_date per person.
  const lastContact = new Map<number, string>();
  for (const log of logs) {
    const prev = lastContact.get(log.personId);
    if (!prev || log.contactDate > prev) {
      lastContact.set(log.personId, log.contactDate);
    }
  }

  const today = todayIso();
  const enriched = active.map((p) => {
    const last = lastContact.get(p.id) ?? null;
    const daysSinceContact = last
      ? differenceInCalendarDays(parseISO(today), parseISO(last))
      : null;
    const urgency =
      daysSinceContact === null
        ? "new"
        : relationshipUrgency(daysSinceContact, p.checkinFrequencyDays);
    return { ...p, lastContactDate: last, daysSinceContact, urgency };
  });

  return jsonOk({ people: enriched });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, createPersonSchema);
  if (!parsed.ok) return parsed.response;
  const {
    name,
    relationshipType,
    checkinFrequencyDays,
    notes,
    birthday,
    whenMet,
    howMet,
    sharedInterests,
  } = parsed.data;

  const [person] = await db
    .insert(people)
    .values({
      name,
      relationshipType,
      checkinFrequencyDays,
      notes: notes ?? null,
      birthday: birthday ?? null,
      whenMet: whenMet ?? null,
      howMet: howMet ?? null,
      sharedInterests: sharedInterests ?? null,
    })
    .returning();

  // A birthday auto-creates a recurring important_dates row linked to the person.
  let dateRow = null;
  if (birthday) {
    [dateRow] = await db
      .insert(importantDates)
      .values({
        title: `${name}'s Birthday`,
        eventDate: birthday,
        type: "birthday",
        isRecurring: 1,
        personId: person.id,
      })
      .returning();
  }

  return jsonOk({ person, importantDate: dateRow }, 201);
}

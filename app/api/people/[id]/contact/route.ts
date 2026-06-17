// POST /api/people/[id]/contact — log contact with a person (+15 XP, highest action).
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { awardXp, XP_VALUES } from "@/lib/award-xp";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/domain";
import { contactLogs, people } from "@/lib/schema";

const contactSchema = z.object({
  // Defaults to today; editable.
  contactDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").optional(),
  note: z.string().max(1000).nullish(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const personId = Number(id);
  if (!Number.isInteger(personId)) return jsonError("Invalid person id", 400);

  const parsed = await parseBody(req, contactSchema);
  if (!parsed.ok) return parsed.response;

  const [person] = await db.select().from(people).where(eq(people.id, personId));
  if (!person) return jsonError("Person not found", 404);

  const xp = XP_VALUES.contact;
  const [log] = await db
    .insert(contactLogs)
    .values({
      personId,
      contactDate: parsed.data.contactDate ?? todayIso(),
      note: parsed.data.note ?? null,
      xpAwarded: xp,
    })
    .returning();

  const award = await awardXp("contact", xp, log.id);

  return jsonOk({ log, award }, 201);
}

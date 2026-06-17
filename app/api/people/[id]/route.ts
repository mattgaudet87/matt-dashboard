// PATCH /api/people/[id] — edit a person and/or archive (history is preserved).
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { people } from "@/lib/schema";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    relationshipType: z
      .enum(["family", "friend", "partner", "mentor", "other"])
      .optional(),
    checkinFrequencyDays: z.number().int().positive().optional(),
    notes: z.string().max(2000).nullish(),
    birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").nullish(),
    whenMet: z.string().max(2000).nullish(),
    howMet: z.string().max(2000).nullish(),
    sharedInterests: z.string().max(2000).nullish(),
    isActive: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const personId = Number(id);
  if (!Number.isInteger(personId)) return jsonError("Invalid person id", 400);

  const parsed = await parseBody(req, patchSchema);
  if (!parsed.ok) return parsed.response;

  const [person] = await db.select().from(people).where(eq(people.id, personId));
  if (!person) return jsonError("Person not found", 404);

  const updates: Partial<typeof people.$inferInsert> = {};
  const {
    name,
    relationshipType,
    checkinFrequencyDays,
    notes,
    birthday,
    whenMet,
    howMet,
    sharedInterests,
    isActive,
  } = parsed.data;
  if (name !== undefined) updates.name = name;
  if (relationshipType !== undefined) updates.relationshipType = relationshipType;
  if (checkinFrequencyDays !== undefined) updates.checkinFrequencyDays = checkinFrequencyDays;
  if (notes !== undefined) updates.notes = notes;
  if (birthday !== undefined) updates.birthday = birthday ?? null;
  if (whenMet !== undefined) updates.whenMet = whenMet ?? null;
  if (howMet !== undefined) updates.howMet = howMet ?? null;
  if (sharedInterests !== undefined) updates.sharedInterests = sharedInterests ?? null;
  if (isActive !== undefined) updates.isActive = isActive;

  const [updated] = await db
    .update(people)
    .set(updates)
    .where(eq(people.id, personId))
    .returning();

  return jsonOk({ person: updated });
}

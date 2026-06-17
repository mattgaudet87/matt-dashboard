// GET /api/chores  — active chores with overdue/due flags.
// POST /api/chores — add a chore (first next_due_date = today).
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { jsonOk, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/domain";
import { chores } from "@/lib/schema";

const createChoreSchema = z.object({
  name: z.string().trim().min(1).max(120),
  frequencyDays: z.number().int().positive(),
  // Start date — first next_due_date. Defaults to today when omitted.
  nextDueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
  isRepeating: z.union([z.literal(0), z.literal(1)]).default(1),
  notes: z.string().max(1000).nullish(),
});

export async function GET() {
  const today = todayIso();
  const rows = await db
    .select()
    .from(chores)
    .where(eq(chores.isActive, 1))
    .orderBy(asc(chores.nextDueDate));

  const enriched = rows.map((c) => ({
    ...c,
    dueToday: c.nextDueDate === today,
    overdue: c.nextDueDate < today,
  }));

  return jsonOk({ chores: enriched });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, createChoreSchema);
  if (!parsed.ok) return parsed.response;
  const { name, frequencyDays, nextDueDate, isRepeating, notes } = parsed.data;

  // First next_due_date is the chosen start date, defaulting to today.
  const [chore] = await db
    .insert(chores)
    .values({
      name,
      frequencyDays,
      nextDueDate: nextDueDate ?? todayIso(),
      isRepeating,
      notes: notes ?? null,
    })
    .returning();

  return jsonOk({ chore }, 201);
}

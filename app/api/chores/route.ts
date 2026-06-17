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
  const { name, frequencyDays, notes } = parsed.data;

  // New chores are due immediately (next_due_date = today).
  const [chore] = await db
    .insert(chores)
    .values({ name, frequencyDays, nextDueDate: todayIso(), notes: notes ?? null })
    .returning();

  return jsonOk({ chore }, 201);
}

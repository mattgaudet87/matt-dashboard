// POST /api/budget/entry — log money against a category (amount in cents).
// The entry type is derived from the category kind: a "saving" category records
// a savings contribution (+20 XP, excluded from spending); "spend" otherwise.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { awardXp, XP_VALUES } from "@/lib/award-xp";
import { db } from "@/lib/db";
import { budgetCategories, budgetEntries } from "@/lib/schema";

const entrySchema = z.object({
  categoryId: z.number().int().positive(),
  // Amount in INTEGER cents.
  amount: z.number().int().positive(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  note: z.string().max(500).nullish(),
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, entrySchema);
  if (!parsed.ok) return parsed.response;
  const { categoryId, amount, entryDate, note } = parsed.data;

  const [category] = await db
    .select()
    .from(budgetCategories)
    .where(eq(budgetCategories.id, categoryId));
  if (!category) return jsonError("Budget category not found", 404);

  const yearMonth = entryDate.slice(0, 7); // YYYY-MM
  const entryType = category.kind === "saving" ? "saving" : "spend";

  const [entry] = await db
    .insert(budgetEntries)
    .values({ categoryId, amount, entryDate, yearMonth, entryType, note: note ?? null })
    .returning();

  // Saving money is the highest-value action (+20 XP). Spending earns nothing.
  let award = null;
  if (entryType === "saving") {
    award = await awardXp("saving", XP_VALUES.saving, entry.id);
  }

  return jsonOk({ entry, award }, 201);
}

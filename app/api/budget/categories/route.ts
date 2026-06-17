// GET  /api/budget/categories — every budget category (active + archived) for
//   the Settings manager. Spend totals are not included here; see /api/budget.
// POST /api/budget/categories — create a category. monthlyBudget in INTEGER cents.
import { asc, sql } from "drizzle-orm";
import { z } from "zod";
import { jsonOk, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { budgetCategories } from "@/lib/schema";

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  // Monthly budget in INTEGER cents (clients send dollars × 100).
  monthlyBudget: z.number().int().min(0).default(0),
  kind: z.enum(["spend", "saving"]).default("spend"),
  icon: z.string().trim().max(60).nullish(),
});

export async function GET() {
  const categories = await db
    .select()
    .from(budgetCategories)
    .orderBy(asc(budgetCategories.sortOrder), asc(budgetCategories.id));

  return jsonOk({ categories });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, createCategorySchema);
  if (!parsed.ok) return parsed.response;
  const { name, monthlyBudget, kind, icon } = parsed.data;

  // Append to the end of the sort order.
  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(${budgetCategories.sortOrder}), 0)` })
    .from(budgetCategories);

  const [category] = await db
    .insert(budgetCategories)
    .values({ name, monthlyBudget, kind, icon: icon ?? null, sortOrder: max + 1 })
    .returning();

  return jsonOk({ category }, 201);
}

// GET /api/budget?month=YYYY-MM — categories with this month's spend + remaining.
// Money is in INTEGER cents throughout; clients divide by 100 for display.
import { asc, eq } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api";
import { db } from "@/lib/db";
import { budgetCategories, budgetEntries } from "@/lib/schema";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return jsonError("Invalid month — expected YYYY-MM", 400);
  }

  const categories = await db
    .select()
    .from(budgetCategories)
    .where(eq(budgetCategories.isActive, 1))
    .orderBy(asc(budgetCategories.sortOrder));

  const entries = await db
    .select()
    .from(budgetEntries)
    .where(eq(budgetEntries.yearMonth, month));

  // Sum spend per category (cents).
  const spentByCategory = new Map<number, number>();
  for (const e of entries) {
    spentByCategory.set(e.categoryId, (spentByCategory.get(e.categoryId) ?? 0) + e.amount);
  }

  let totalBudget = 0;
  let totalSpent = 0;
  const categoryRows = categories.map((c) => {
    const spent = spentByCategory.get(c.id) ?? 0;
    totalBudget += c.monthlyBudget;
    totalSpent += spent;
    return {
      ...c,
      spent,
      remaining: c.monthlyBudget - spent,
      overBudget: spent > c.monthlyBudget,
    };
  });

  return jsonOk({
    month,
    categories: categoryRows,
    entries,
    totals: {
      budget: totalBudget,
      spent: totalSpent,
      remaining: totalBudget - totalSpent,
    },
  });
}

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

  // Sum amount per category (cents). Works for both spend and saving entries.
  const amountByCategory = new Map<number, number>();
  for (const e of entries) {
    amountByCategory.set(e.categoryId, (amountByCategory.get(e.categoryId) ?? 0) + e.amount);
  }

  // Spending totals exclude savings categories entirely.
  let totalBudget = 0;
  let totalSpent = 0;
  const categoryRows = categories.map((c) => {
    const amount = amountByCategory.get(c.id) ?? 0;
    if (c.kind !== "saving") {
      totalBudget += c.monthlyBudget;
      totalSpent += amount;
    }
    return {
      ...c,
      // For saving categories `spent` is the amount saved toward the goal.
      spent: amount,
      remaining: c.monthlyBudget - amount,
      overBudget: c.kind !== "saving" && amount > c.monthlyBudget,
      goalMet: c.kind === "saving" && c.monthlyBudget > 0 && amount >= c.monthlyBudget,
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

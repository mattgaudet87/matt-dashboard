// PATCH /api/budget/categories/[id] — edit a category and/or archive it.
// Archiving keeps historical entries intact (they just stop showing in /api/budget).
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { budgetCategories } from "@/lib/schema";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    // INTEGER cents.
    monthlyBudget: z.number().int().min(0).optional(),
    icon: z.string().trim().max(60).nullish(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) return jsonError("Invalid category id", 400);

  const parsed = await parseBody(req, patchSchema);
  if (!parsed.ok) return parsed.response;

  const [category] = await db
    .select()
    .from(budgetCategories)
    .where(eq(budgetCategories.id, categoryId));
  if (!category) return jsonError("Budget category not found", 404);

  const updates: Partial<typeof budgetCategories.$inferInsert> = {};
  const { name, monthlyBudget, icon, sortOrder, isActive } = parsed.data;
  if (name !== undefined) updates.name = name;
  if (monthlyBudget !== undefined) updates.monthlyBudget = monthlyBudget;
  if (icon !== undefined) updates.icon = icon ?? null;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (isActive !== undefined) updates.isActive = isActive;

  const [updated] = await db
    .update(budgetCategories)
    .set(updates)
    .where(eq(budgetCategories.id, categoryId))
    .returning();

  return jsonOk({ category: updated });
}

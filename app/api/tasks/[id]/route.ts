// PATCH /api/tasks/[id] — edit a task and/or change status.
// Completing a task (status → done for the first time) awards +5 XP.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk, parseBody } from "@/lib/api";
import { awardXp, reverseXp, XP_VALUES } from "@/lib/award-xp";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";

const patchTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    category: z
      .enum(["health", "finance", "family", "home", "personal", "chore"])
      .optional(),
    priority: z.enum(["normal", "high"]).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").nullish(),
    notes: z.string().max(2000).nullish(),
    status: z.enum(["open", "done", "archived"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isInteger(taskId)) return jsonError("Invalid task id", 400);

  const parsed = await parseBody(req, patchTaskSchema);
  if (!parsed.ok) return parsed.response;

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return jsonError("Task not found", 404);

  const updates: Partial<typeof tasks.$inferInsert> = {};
  const { title, category, priority, dueDate, notes, status } = parsed.data;
  if (title !== undefined) updates.title = title;
  if (category !== undefined) updates.category = category;
  if (priority !== undefined) updates.priority = priority;
  if (dueDate !== undefined) updates.dueDate = dueDate;
  if (notes !== undefined) updates.notes = notes;

  // Award XP the first time a task is completed; reverse it if a completed task
  // is later reopened/archived — otherwise toggling done↔open would farm XP and
  // leave a phantom award behind.
  const completing = status === "done" && task.status !== "done";
  const uncompleting =
    status !== undefined && status !== "done" && task.status === "done";
  if (status !== undefined) {
    updates.status = status;
    if (completing) {
      updates.completedAt = new Date().toISOString();
      updates.xpAwarded = XP_VALUES.task;
    } else if (uncompleting) {
      updates.completedAt = null;
      updates.xpAwarded = 0;
    } else if (status !== "done") {
      updates.completedAt = null;
    }
  }

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, taskId))
    .returning();

  let award = null;
  if (completing) {
    award = await awardXp("task", XP_VALUES.task, taskId);
  } else if (uncompleting) {
    // Reverse the exact amount this task awarded (removes its xp_log row).
    award = await reverseXp("task", task.xpAwarded, taskId);
  }

  return jsonOk({ task: updated, award });
}

// GET /api/tasks  — list tasks (optionally filtered by status)
// POST /api/tasks — create a task
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { jsonOk, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z
    .enum(["health", "finance", "family", "home", "personal", "chore"])
    .default("personal"),
  priority: z.enum(["normal", "high"]).default("normal"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").nullish(),
  notes: z.string().max(2000).nullish(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // open | done | archived

  const rows = status
    ? await db.select().from(tasks).where(eq(tasks.status, status)).orderBy(desc(tasks.createdAt))
    : await db.select().from(tasks).orderBy(desc(tasks.createdAt));

  return jsonOk({ tasks: rows });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, createTaskSchema);
  if (!parsed.ok) return parsed.response;
  const { title, category, priority, dueDate, notes } = parsed.data;

  const [task] = await db
    .insert(tasks)
    .values({
      title,
      category,
      priority,
      dueDate: dueDate ?? null,
      notes: notes ?? null,
    })
    .returning();

  return jsonOk({ task }, 201);
}

// GET /api/xp — the XP ledger for the Settings history view.
// Returns lifetime total, a per-action breakdown, and the most recent awards.
import { desc, sql } from "drizzle-orm";
import { jsonOk } from "@/lib/api";
import { db } from "@/lib/db";
import { xpLog } from "@/lib/schema";

const RECENT_LIMIT = 50;

export async function GET() {
  const [totals, byType, recent] = await Promise.all([
    db
      .select({ total: sql<number>`COALESCE(SUM(${xpLog.xpAwarded}), 0)` })
      .from(xpLog),
    db
      .select({
        actionType: xpLog.actionType,
        xp: sql<number>`COALESCE(SUM(${xpLog.xpAwarded}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(xpLog)
      .groupBy(xpLog.actionType),
    db
      .select()
      .from(xpLog)
      .orderBy(desc(xpLog.id))
      .limit(RECENT_LIMIT),
  ]);

  return jsonOk({
    total: totals[0]?.total ?? 0,
    byType,
    recent,
  });
}

// GET /api/xp?range=week|month|3m|6m|1y|all — XP ledger aggregates for the XP
// history page. Returns lifetime/week/month totals + level progress, a per-day
// XP series for the selected range, a per-action breakdown for the range, and
// the most recent awards. Defaults to range=all (keeps the Settings view working).
import {
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subYears,
} from "date-fns";
import { desc, eq } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api";
import { levelProgress } from "@/lib/award-xp";
import { db } from "@/lib/db";
import { users, xpLog } from "@/lib/schema";

const RECENT_LIMIT = 50;
const RANGES = ["week", "month", "3m", "6m", "1y", "all"] as const;
type Range = (typeof RANGES)[number];

// xp_log.created_at is "YYYY-MM-DD HH:MM:SS" (SQLite CURRENT_TIMESTAMP, UTC).
// Convert to the local calendar date the event happened on.
function localDate(raw: string): string {
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return format(d, "yyyy-MM-dd");
}

function rangeStart(range: Range, now: Date): string {
  switch (range) {
    case "week":
      return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "month":
      return format(startOfMonth(now), "yyyy-MM-dd");
    case "3m":
      return format(subMonths(now, 3), "yyyy-MM-dd");
    case "6m":
      return format(subMonths(now, 6), "yyyy-MM-dd");
    case "1y":
      return format(subYears(now, 1), "yyyy-MM-dd");
    case "all":
      return "0000-01-01";
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rangeParam = searchParams.get("range") ?? "all";
  if (!RANGES.includes(rangeParam as Range)) {
    return jsonError(`Invalid range — expected one of ${RANGES.join(", ")}`, 400);
  }
  const range = rangeParam as Range;

  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const start = rangeStart(range, now);

  const [logs, [user]] = await Promise.all([
    db.select().from(xpLog).orderBy(desc(xpLog.id)),
    db.select().from(users).where(eq(users.id, 1)),
  ]);

  let total = 0;
  let weekXp = 0;
  let monthXp = 0;
  const seriesMap = new Map<string, number>();
  const byTypeMap = new Map<string, { xp: number; count: number }>();

  for (const log of logs) {
    const date = localDate(log.createdAt);
    total += log.xpAwarded;
    if (date >= weekStart) weekXp += log.xpAwarded;
    if (date >= monthStart) monthXp += log.xpAwarded;

    if (date >= start) {
      seriesMap.set(date, (seriesMap.get(date) ?? 0) + log.xpAwarded);
      const bt = byTypeMap.get(log.actionType) ?? { xp: 0, count: 0 };
      bt.xp += log.xpAwarded;
      bt.count += 1;
      byTypeMap.set(log.actionType, bt);
    }
  }

  const series = [...seriesMap.entries()]
    .map(([date, xp]) => ({ date, xp }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byType = [...byTypeMap.entries()]
    .map(([actionType, v]) => ({ actionType, xp: v.xp, count: v.count }))
    .sort((a, b) => b.xp - a.xp);

  const progress = levelProgress(user?.currentXp ?? 0);

  return jsonOk({
    range,
    total,
    byType,
    series,
    recent: logs.slice(0, RECENT_LIMIT),
    summary: {
      total,
      week: weekXp,
      month: monthXp,
      level: progress.level,
      xpIntoLevel: progress.xpIntoLevel,
      xpForLevel: progress.xpForLevel,
      xpToNext: progress.xpToNext,
    },
  });
}

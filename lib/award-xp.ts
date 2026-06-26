// Shared XP helper. EVERY XP award in the app goes through awardXp() — never
// mutate users.current_xp / level / streak directly. It updates the user row,
// recomputes level, advances the global streak, and appends to xp_log.
import { format, parseISO, subDays } from "date-fns";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { todayIso } from "./format";
import { users, xpLog } from "./schema";

export type XpActionType =
  | "habit"
  | "task"
  | "contact"
  | "chore"
  | "workout"
  | "saving";

// Canonical XP values per action (BUILD_PLAN §2.9).
export const XP_VALUES: Record<XpActionType, number> = {
  habit: 10,
  task: 5,
  contact: 15,
  chore: 8,
  workout: 12,
  saving: 20,
};

// XP cost to advance FROM `level` to the next level.
// Levels 1–5 = 500 each | 6–10 = 1000 each | 11+ = 2000 each.
function levelCost(level: number): number {
  if (level <= 5) return 500;
  if (level <= 10) return 1000;
  return 2000;
}

export interface LevelProgress {
  level: number;
  levelStartXp: number; // total XP at which this level began
  xpForLevel: number; // XP required to clear this level
  xpIntoLevel: number; // XP earned into the current level
  xpToNext: number; // XP remaining to the next level
}

// Derive level + progress from a total XP figure.
export function levelProgress(totalXp: number): LevelProgress {
  let level = 1;
  let cumulative = 0;
  while (totalXp >= cumulative + levelCost(level)) {
    cumulative += levelCost(level);
    level += 1;
  }
  const xpForLevel = levelCost(level);
  const xpIntoLevel = totalXp - cumulative;
  return {
    level,
    levelStartXp: cumulative,
    xpForLevel,
    xpIntoLevel,
    xpToNext: xpForLevel - xpIntoLevel,
  };
}

export function computeLevel(totalXp: number): number {
  return levelProgress(totalXp).level;
}

export interface AwardXpResult {
  currentXp: number;
  level: number;
  leveledUp: boolean;
  streakCount: number;
}

// Award XP for an action and update gamification state for the single user
// (id = 1). Call this AFTER inserting the source row so referenceId is known.
export async function awardXp(
  actionType: XpActionType,
  xpAwarded: number,
  referenceId?: number,
): Promise<AwardXpResult> {
  const [user] = await db.select().from(users).where(eq(users.id, 1));
  if (!user) {
    throw new Error("User row (id = 1) not found — run `npm run db:seed`.");
  }

  // Both anchored to the app's home timezone (midnight Moncton), so a late-
  // evening completion counts for the right calendar day. yesterday is pure
  // date arithmetic on today's ISO string, so it's TZ-independent.
  const today = todayIso();
  const yesterday = format(subDays(parseISO(today), 1), "yyyy-MM-dd");

  // --- global streak ---
  // yesterday → increment | today → unchanged | older/null → reset to 1.
  let streakCount = user.streakCount;
  if (user.streakLastDate === today) {
    // already acted today — leave streak as-is
  } else if (user.streakLastDate === yesterday) {
    streakCount += 1;
  } else {
    streakCount = 1;
  }

  // --- xp + level ---
  const currentXp = user.currentXp + xpAwarded;
  const level = computeLevel(currentXp);
  const leveledUp = level > user.level;

  await db
    .update(users)
    .set({ currentXp, level, streakCount, streakLastDate: today })
    .where(eq(users.id, 1));

  await db.insert(xpLog).values({
    actionType,
    xpAwarded,
    referenceId: referenceId ?? null,
  });

  return { currentXp, level, leveledUp, streakCount };
}

// Reverse a previously-awarded action (e.g. un-checking a habit logged today).
// Deducts the XP, recomputes level, and removes the matching xp_log row so the
// ledger and the XP history stay accurate — as if the action never happened.
// The streak is intentionally left untouched: a single undo should not retro-
// actively break a streak that other actions may also be sustaining.
export async function reverseXp(
  actionType: XpActionType,
  xpAmount: number,
  referenceId?: number,
): Promise<AwardXpResult> {
  const [user] = await db.select().from(users).where(eq(users.id, 1));
  if (!user) {
    throw new Error("User row (id = 1) not found — run `npm run db:seed`.");
  }

  const currentXp = Math.max(0, user.currentXp - xpAmount);
  const level = computeLevel(currentXp);

  await db.update(users).set({ currentXp, level }).where(eq(users.id, 1));

  if (referenceId !== undefined) {
    await db
      .delete(xpLog)
      .where(
        and(
          eq(xpLog.actionType, actionType),
          eq(xpLog.referenceId, referenceId),
        ),
      );
  }

  return { currentXp, level, leveledUp: false, streakCount: user.streakCount };
}

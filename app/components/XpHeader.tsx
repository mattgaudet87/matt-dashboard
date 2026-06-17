"use client";

import Link from "next/link";
import { useDashboard } from "../providers";

// Sticky top header on every page: level, XP progress bar, global streak.
// Tapping anywhere on the bar navigates to the XP history page.
export default function XpHeader() {
  const { data } = useDashboard();
  const user = data?.user;
  const progress = user?.progress;
  const pct = progress
    ? Math.min(100, Math.round((progress.xpIntoLevel / progress.xpForLevel) * 100))
    : 0;

  return (
    <Link
      href="/xp"
      aria-label="View XP history"
      className="sticky top-0 z-20 block bg-accent px-4 pb-3 pt-4 text-white active:bg-accent/90"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white/15 px-2 py-0.5 text-sm font-semibold">
            Level {user?.level ?? 1}
          </span>
          <span className="text-sm text-white/80">{user?.currentXp ?? 0} XP</span>
        </div>
        <span className="flex items-center gap-1 text-sm font-medium">
          <span aria-hidden>🔥</span>
          {user?.streakCount ?? 0}-day streak
        </span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/25">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-white/80">
        {progress
          ? `${progress.xpIntoLevel} / ${progress.xpForLevel} XP · ${progress.xpToNext} to level ${progress.level + 1}`
          : "Loading…"}
      </div>
    </Link>
  );
}

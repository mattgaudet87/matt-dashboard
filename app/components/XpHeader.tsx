"use client";

import Link from "next/link";
import { useDashboard } from "../providers";

// Persistent dark header on every screen: level badge, XP count, streak, and
// the always-glowing XP progress bar. Tapping the bar opens the Me screen.
export default function XpHeader() {
  const { data } = useDashboard();
  const user = data?.user;
  const progress = user?.progress;
  const pct = progress
    ? Math.min(100, Math.round((progress.xpIntoLevel / progress.xpForLevel) * 100))
    : 0;

  return (
    <Link
      href="/me"
      aria-label="View profile & XP history"
      className="sticky top-0 z-20 block border-b border-line bg-bg px-5 pb-3 pt-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-white">
            LVL {user?.level ?? 1}
          </span>
          <span className="text-sm font-medium text-muted">
            {user?.currentXp ?? 0} XP
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <span aria-hidden>🔥</span>
          {user?.streakCount ?? 0}
          <span className="font-medium text-muted">
            {(user?.streakCount ?? 0) === 1 ? "day" : "days"}
          </span>
        </span>
      </div>

      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="animate-xp-glow h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-500"
          style={{ width: `${Math.max(pct, 3)}%` }}
        />
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-dim">
        {progress
          ? `${progress.xpIntoLevel} / ${progress.xpForLevel} XP · ${progress.xpToNext} to Level ${progress.level + 1}`
          : "Loading…"}
      </div>
    </Link>
  );
}

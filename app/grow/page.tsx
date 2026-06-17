"use client";

import { useState } from "react";
import HealthPage from "../health/page";
import HabitsPage from "../habits/page";

// "Grow" merges Health and Habits behind sub-tabs (redesign IA).
// Phase 2 composes the existing screens; Phase 4 restyles them to dark cards.
const TABS = [
  { key: "health", label: "Health" },
  { key: "habits", label: "Habits" },
] as const;

export default function GrowPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("health");

  return (
    <div className="animate-screen space-y-4">
      <div className="flex gap-1 rounded-full bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`min-h-[40px] flex-1 rounded-full text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-accent text-white" : "text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "health" ? <HealthPage /> : <HabitsPage />}
    </div>
  );
}

"use client";

import { useState } from "react";
import HealthSection from "./HealthSection";
import HabitsSection from "./HabitsSection";

// "Grow" merges Health and Habits behind sub-tabs (redesign IA).
const TABS = [
  { key: "health", label: "Health" },
  { key: "habits", label: "Habits" },
] as const;

export default function GrowPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("health");

  return (
    <div className="animate-screen space-y-4">
      <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
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

      {tab === "health" ? <HealthSection /> : <HabitsSection />}
    </div>
  );
}

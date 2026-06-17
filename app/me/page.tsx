"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, SectionHeader } from "../components/ui";
import { useDashboard } from "../providers";
import type { XpRange, XpResponse } from "@/lib/types";

const RANGES: { value: XpRange; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "3m", label: "3M" },
  { value: "1y", label: "Year" },
  { value: "all", label: "All" },
];

const ACTION_META: Record<string, { label: string; icon: string }> = {
  habit: { label: "Habit", icon: "✅" },
  task: { label: "Task", icon: "📋" },
  contact: { label: "Relationship", icon: "💬" },
  chore: { label: "Chore", icon: "🧹" },
  workout: { label: "Workout", icon: "🏋️" },
  saving: { label: "Savings", icon: "💰" },
};

function actionMeta(type: string) {
  return ACTION_META[type] ?? { label: type, icon: "⭐" };
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function MePage() {
  const { data: dash } = useDashboard();
  const [range, setRange] = useState<XpRange>("month");
  const [data, setData] = useState<XpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: XpRange) => {
    try {
      const res = await fetch(`/api/xp?range=${r}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as XpResponse);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(range);
  }, [load, range]);

  const summary = data?.summary;
  const series = data?.series ?? [];
  const byType = data?.byType ?? [];
  const name = dash?.greeting.name ?? "Matt";
  const level = summary?.level ?? dash?.user?.level ?? 1;
  const into = summary?.xpIntoLevel ?? dash?.user?.progress?.xpIntoLevel ?? 0;
  const forLevel = summary?.xpForLevel ?? dash?.user?.progress?.xpForLevel ?? 500;
  const toNext = summary?.xpToNext ?? dash?.user?.progress?.xpToNext ?? forLevel - into;
  const pct = forLevel > 0 ? Math.min(1, into / forLevel) : 0;

  return (
    <div className="animate-screen space-y-6">
      <h1 className="text-[22px] font-bold">Me</h1>

      {/* Profile + level ring */}
      <Card className="flex items-center gap-5">
        <LevelRing level={level} pct={pct} />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-ink">{name}</p>
          <p className="text-xs text-muted">Personal life dashboard</p>
          <p className="mt-2 text-xs text-dim">
            {into} / {forLevel} XP · {toNext} to Level {level + 1}
          </p>
        </div>
      </Card>

      {/* XP over time */}
      <section>
        <SectionHeader title="XP Over Time" />
        <div className="mb-2.5 flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`min-h-[40px] flex-1 rounded-lg text-xs font-semibold ${
                range === r.value ? "bg-accent text-white" : "bg-surface text-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Card>
          {error && !data ? (
            <p className="py-10 text-center text-sm text-coral">{error}</p>
          ) : series.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              No XP earned in this range yet.
            </p>
          ) : (
            <div className="w-full">
              <ResponsiveContainer width="100%" height={224} minWidth={0}>
                <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="xpStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7b61ff" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1c1f2e" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fontSize: 11, fill: "#7a80a0" }}
                    tickLine={false}
                    axisLine={{ stroke: "#1c1f2e" }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#7a80a0" }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    allowDecimals={false}
                  />
                  <Tooltip
                    labelFormatter={(l) => shortDate(String(l))}
                    formatter={(v) => [`${v} XP`, "Earned"]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #1c1f2e",
                      background: "#12141c",
                      fontSize: 12,
                      color: "#eff1f9",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="xp"
                    stroke="url(#xpStroke)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: "#7b61ff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </section>

      {/* Breakdown by action */}
      <section>
        <SectionHeader title="Breakdown by Action" />
        {byType.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-muted">No actions logged in this range.</p>
          </Card>
        ) : (
          <Card padded={false} className="divide-y divide-line">
            {byType
              .slice()
              .sort((a, b) => b.xp - a.xp)
              .map((t) => {
                const meta = actionMeta(t.actionType);
                return (
                  <div
                    key={t.actionType}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span className="text-ink">
                      <span aria-hidden className="mr-1.5">
                        {meta.icon}
                      </span>
                      {meta.label}
                      <span className="text-dim"> · {t.count} logs</span>
                    </span>
                    <span className="font-semibold text-accent">{t.xp} XP</span>
                  </div>
                );
              })}
          </Card>
        )}
      </section>
    </div>
  );
}

// --- SVG level ring (r=44, gradient stroke) --------------------------------

function LevelRing({ level, pct }: { level: number; pct: number }) {
  const r = 44;
  const c = 2 * Math.PI * r; // ≈ 276
  const offset = c * (1 - pct);
  return (
    <div className="relative shrink-0" style={{ width: 104, height: 104 }}>
      <svg width="104" height="104" viewBox="0 0 104 104">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7b61ff" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <circle cx="52" cy="52" r={r} fill="none" stroke="#1c1f2e" strokeWidth="7" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 52 52)"
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Level</span>
        <span className="text-2xl font-bold text-ink">{level}</span>
      </div>
    </div>
  );
}

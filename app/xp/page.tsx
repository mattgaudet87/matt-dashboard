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
import type { XpRange, XpResponse } from "@/lib/types";

const RANGES: { value: XpRange; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "all", label: "All Time" },
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

// Short axis label, e.g. "Jun 17".
function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function XpPage() {
  const [range, setRange] = useState<XpRange>("month");
  const [data, setData] = useState<XpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: XpRange) => {
    try {
      const res = await fetch(`/api/xp?range=${r}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as XpResponse);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(range);
  }, [load, range]);

  if (loading && !data) {
    return <p className="py-12 text-center text-slate-400">Loading XP history…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Couldn’t load your XP history.</p>
        <button
          onClick={() => load(range)}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) return null;

  const summary = data.summary;
  const series = data.series ?? [];
  const byType = data.byType ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">XP History</h1>
        <p className="text-sm text-slate-500">Every point you’ve earned.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Total XP" value={`${summary?.total ?? 0}`} sub="all time" />
        <SummaryCard label="This Week" value={`${summary?.week ?? 0}`} sub="XP earned" />
        <SummaryCard label="This Month" value={`${summary?.month ?? 0}`} sub="XP earned" />
        <SummaryCard
          label={`Level ${summary?.level ?? 1}`}
          value={`${summary?.xpToNext ?? 0}`}
          sub={`XP to level ${(summary?.level ?? 1) + 1}`}
        />
      </div>

      {/* Range selector */}
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium ${
              range === r.value ? "bg-accent text-white" : "bg-white text-slate-600"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <section className="rounded-xl bg-white p-3">
        <h2 className="mb-2 px-1 text-sm font-semibold text-slate-500">XP over time</h2>
        {series.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            No XP earned in this range yet.
          </p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  allowDecimals={false}
                />
                <Tooltip
                  labelFormatter={(l) => shortDate(String(l))}
                  formatter={(v) => [`${v} XP`, "Earned"]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="xp"
                  stroke="#1A56A0"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Breakdown by action type */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-slate-500">
          Breakdown by action
        </h2>
        {byType.length === 0 ? (
          <p className="rounded-xl bg-white px-3 py-8 text-center text-sm text-slate-400">
            No actions logged in this range.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl bg-white">
            <li className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <span>Action</span>
              <span className="flex gap-6">
                <span className="w-10 text-right">Count</span>
                <span className="w-14 text-right">XP</span>
              </span>
            </li>
            {byType.map((t) => {
              const meta = actionMeta(t.actionType);
              return (
                <li
                  key={t.actionType}
                  className="flex items-center justify-between border-b border-slate-50 px-4 py-3 text-sm last:border-0"
                >
                  <span className="text-slate-600">
                    <span aria-hidden className="mr-1.5">
                      {meta.icon}
                    </span>
                    {meta.label}
                  </span>
                  <span className="flex gap-6">
                    <span className="w-10 text-right text-slate-500">{t.count}</span>
                    <span className="w-14 text-right font-semibold text-accent">
                      {t.xp}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

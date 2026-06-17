"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "../providers";
import { Card, SectionHeader, StatCard } from "../components/ui";
import type { HealthResponse, WorkoutLogItem } from "@/lib/types";

const WORKOUT_TYPES = ["run", "lift", "bike", "swim", "other"] as const;

const TYPE_EMOJI: Record<string, string> = {
  run: "🏃",
  lift: "🏋️",
  bike: "🚴",
  swim: "🏊",
  other: "💪",
};

const inputCls =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-dim focus:border-accent";

export default function HealthSection() {
  const { refresh: refreshDashboard } = useDashboard();
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/health/workout", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as HealthResponse);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading && !data) {
    return <p className="py-12 text-center text-muted">Loading health…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">Couldn’t load health data.</p>
        <button
          onClick={load}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold">Health &amp; Fitness</h2>
          <p className="text-sm text-muted">Log a workout · +12 XP each</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white active:opacity-90"
        >
          {showForm ? "Close" : "+ Log"}
        </button>
      </div>

      {showForm && (
        <LogWorkoutForm
          today={data.today}
          onLogged={async () => {
            setShowForm(false);
            await Promise.all([load(), refreshDashboard()]);
          }}
        />
      )}

      {/* Health score + weekly summary */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          label="Health Score"
          value={`${data.healthScore}`}
          sub="of 100 this week"
          tone="sky"
        />
        <StatCard
          label="This Week"
          value={`${data.weekly.workouts}`}
          sub={`workout${data.weekly.workouts === 1 ? "" : "s"} · ${data.weekly.minutes} min`}
        />
      </div>

      {/* 8-week chart */}
      <section>
        <SectionHeader title="Last 8 Weeks" />
        <Card>
          <WeekChart weeks={data.weeks} />
        </Card>
      </section>

      {/* Strava quick link */}
      <a
        href="https://www.strava.com/dashboard"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-[18px] bg-[#FC4C02] py-3 text-sm font-semibold text-white active:opacity-90"
      >
        Open Strava ↗
      </a>

      {/* Recent workouts */}
      <section>
        <SectionHeader title="Recent Workouts" />
        {data.recent.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-muted">No workouts logged yet.</p>
          </Card>
        ) : (
          <Card padded={false} className="divide-y divide-line">
            {data.recent.map((w) => (
              <WorkoutRow key={w.id} workout={w} />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

// --- 8-week bar chart ------------------------------------------------------

function WeekChart({ weeks }: { weeks: HealthResponse["weeks"] }) {
  const max = Math.max(1, ...weeks.map((w) => w.workouts));
  return (
    <div className="flex items-stretch justify-between gap-1.5" style={{ height: 96 }}>
      {weeks.map((w, i) => {
        const heightPct = (w.workouts / max) * 100;
        const isCurrent = i === weeks.length - 1;
        return (
          <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end">
              <div
                title={`${w.weekStart}: ${w.workouts} workouts, ${w.minutes} min`}
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(heightPct, w.workouts > 0 ? 8 : 3)}%`,
                  backgroundColor: isCurrent ? "#7b61ff" : "#252840",
                }}
              />
            </div>
            <span className="text-[10px] text-dim">{w.weekStart.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- recent workout row ----------------------------------------------------

function WorkoutRow({ workout }: { workout: WorkoutLogItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-lg">{TYPE_EMOJI[workout.type] ?? "💪"}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium capitalize text-ink">
          {workout.type}
          {workout.durationMinutes ? ` · ${workout.durationMinutes} min` : ""}
        </p>
        {workout.notes && <p className="truncate text-xs text-muted">{workout.notes}</p>}
      </div>
      <span className="shrink-0 text-xs text-dim">{workout.workoutDate}</span>
    </div>
  );
}

// --- log workout form ------------------------------------------------------

function LogWorkoutForm({
  today,
  onLogged,
}: {
  today: string;
  onLogged: () => void;
}) {
  const [type, setType] = useState<(typeof WORKOUT_TYPES)[number]>("run");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const mins = duration.trim() ? Number(duration) : null;
      const res = await fetch("/api/health/workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutDate: date,
          type,
          durationMinutes: mins,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t log workout");
      }
      onLogged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t log workout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Type</p>
          <div className="flex flex-wrap gap-2">
            {WORKOUT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                  type === t ? "bg-accent text-white" : "bg-surface-2 text-muted"
                }`}
              >
                {TYPE_EMOJI[t]} {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-medium text-muted">Duration (min)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="30"
              className={inputCls}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-medium text-muted">Date</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className={inputCls}
        />

        {err && <p className="text-xs text-coral">{err}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Log workout"}
        </button>
      </form>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import DotGrid from "../components/DotGrid";
import { useDashboard } from "../providers";
import type { HabitListItem, HabitsResponse } from "@/lib/types";

const CATEGORIES = ["health", "mindset", "relationships", "other"] as const;
const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "custom", label: "Custom" },
] as const;
// JS weekday numbers (0 = Sun) in Mon→Sun display order.
const CUSTOM_DAYS = [
  { num: 1, label: "M" },
  { num: 2, label: "T" },
  { num: 3, label: "W" },
  { num: 4, label: "T" },
  { num: 5, label: "F" },
  { num: 6, label: "S" },
  { num: 0, label: "S" },
];

export default function HabitsPage() {
  const { refresh: refreshDashboard } = useDashboard();
  const [data, setData] = useState<HabitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/habits", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as HabitsResponse);
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

  function setPendingId(id: number, on: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function complete(h: HabitListItem) {
    setPendingId(h.id, true);
    try {
      const res = await fetch(`/api/habits/${h.id}/log`, { method: "POST" });
      if (res.ok || res.status === 409) {
        await Promise.all([load(), refreshDashboard()]);
      }
    } finally {
      setPendingId(h.id, false);
    }
  }

  async function uncomplete(h: HabitListItem) {
    setPendingId(h.id, true);
    try {
      const res = await fetch(`/api/habits/${h.id}/log`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        await Promise.all([load(), refreshDashboard()]);
      }
    } finally {
      setPendingId(h.id, false);
    }
  }

  async function archive(h: HabitListItem) {
    setPendingId(h.id, true);
    try {
      const res = await fetch(`/api/habits/${h.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: 0 }),
      });
      if (res.ok) await load();
    } finally {
      setPendingId(h.id, false);
    }
  }

  if (loading && !data) {
    return <p className="py-12 text-center text-slate-400">Loading habits…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Couldn’t load your habits.</p>
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
          <h1 className="text-2xl font-bold">Habits</h1>
          <p className="text-sm text-slate-500">Tap to complete · +10 XP each</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          {showForm ? "Close" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <AddHabitForm
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}

      {data.habits.length === 0 ? (
        <p className="rounded-xl bg-white px-3 py-8 text-center text-sm text-slate-400">
          No habits yet. Add one to start building streaks.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.habits.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              pending={pending.has(h.id)}
              onComplete={() => complete(h)}
              onUndo={() => uncomplete(h)}
              onArchive={() => archive(h)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// --- habit card ------------------------------------------------------------

const CATEGORY_TONE: Record<string, string> = {
  health: "bg-emerald-100 text-emerald-700",
  mindset: "bg-violet-100 text-violet-700",
  relationships: "bg-rose-100 text-rose-700",
  other: "bg-slate-100 text-slate-600",
};

function HabitCard({
  habit,
  pending,
  onComplete,
  onUndo,
  onArchive,
}: {
  habit: HabitListItem;
  pending: boolean;
  onComplete: () => void;
  onUndo: () => void;
  onArchive: () => void;
}) {
  const done = habit.completedToday;
  return (
    <li className="rounded-xl bg-white p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={done ? onUndo : onComplete}
          disabled={pending}
          aria-label={done ? `Undo ${habit.name}` : `Complete ${habit.name}`}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-lg ${
            done
              ? "border-accent bg-accent text-white"
              : "border-slate-300 text-transparent active:bg-slate-50"
          } disabled:opacity-60`}
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <p className={`truncate font-medium ${done ? "text-slate-400 line-through" : ""}`}>
            {habit.name}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
            <span
              className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
                CATEGORY_TONE[habit.category] ?? CATEGORY_TONE.other
              }`}
            >
              {habit.category}
            </span>
            {habit.streak > 0 && <span>🔥 {habit.streak}-day streak</span>}
          </div>
        </div>
        {done ? (
          <button
            onClick={onUndo}
            disabled={pending}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-500 active:bg-slate-50 disabled:opacity-60"
          >
            Undo
          </button>
        ) : (
          <button
            onClick={onArchive}
            disabled={pending}
            className="shrink-0 px-1 py-2 text-xs font-medium text-slate-400 active:text-slate-600 disabled:opacity-60"
          >
            Archive
          </button>
        )}
      </div>
      <div className="mt-3 pl-1">
        <DotGrid week={habit.week} showLabels size="md" />
      </div>
    </li>
  );
}

// --- add form --------------------------------------------------------------

function AddHabitForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("health");
  const [frequencyType, setFrequencyType] =
    useState<(typeof FREQUENCIES)[number]["value"]>("daily");
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleDay(num: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          frequencyType,
          frequencyDays: frequencyType === "custom" ? [...days] : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t save habit");
      }
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save habit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Habit name (e.g. Drink 2L water)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
        autoFocus
      />

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Category</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                category === c ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Frequency</p>
        <div className="flex gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFrequencyType(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                frequencyType === f.value ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {frequencyType === "custom" && (
        <div className="flex gap-1.5">
          {CUSTOM_DAYS.map((d) => (
            <button
              key={d.num}
              type="button"
              onClick={() => toggleDay(d.num)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                days.has(d.num) ? "bg-accent text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {err && <p className="text-xs text-red-600">{err}</p>}

      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Add habit"}
      </button>
    </form>
  );
}

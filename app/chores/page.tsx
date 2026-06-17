"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "../providers";
import type { ChoreRow, ChoresResponse } from "@/lib/types";

const FREQUENCIES = [
  { days: 1, label: "Daily" },
  { days: 7, label: "Weekly" },
  { days: 14, label: "Bi-weekly" },
  { days: 30, label: "Monthly" },
  { days: 90, label: "Quarterly" },
] as const;

function dueLabel(c: ChoreRow): string {
  if (c.overdue) return `Overdue · was due ${c.nextDueDate}`;
  if (c.dueToday) return "Due today";
  return `Next due ${c.nextDueDate}`;
}

export default function ChoresPage() {
  const { refresh: refreshDashboard } = useDashboard();
  const [data, setData] = useState<ChoresResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/chores", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as ChoresResponse);
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

  async function done(c: ChoreRow) {
    setPendingId(c.id, true);
    try {
      const res = await fetch(`/api/chores/${c.id}/done`, { method: "PATCH" });
      if (res.ok) await Promise.all([load(), refreshDashboard()]);
    } finally {
      setPendingId(c.id, false);
    }
  }

  async function archive(c: ChoreRow) {
    setPendingId(c.id, true);
    try {
      const res = await fetch(`/api/chores/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: 0 }),
      });
      if (res.ok) await load();
    } finally {
      setPendingId(c.id, false);
    }
  }

  if (loading && !data) {
    return <p className="py-12 text-center text-slate-400">Loading chores…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Couldn’t load your chores.</p>
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
          <h1 className="text-2xl font-bold">Chores</h1>
          <p className="text-sm text-slate-500">Mark done · +8 XP each</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          {showForm ? "Close" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <AddChoreForm
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}

      {data.chores.length === 0 ? (
        <p className="rounded-xl bg-white px-3 py-8 text-center text-sm text-slate-400">
          No chores yet. Add the recurring stuff you keep forgetting.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.chores.map((c) => (
            <ChoreCard
              key={c.id}
              chore={c}
              pending={pending.has(c.id)}
              onDone={() => done(c)}
              onArchive={() => archive(c)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// --- chore card ------------------------------------------------------------

function ChoreCard({
  chore,
  pending,
  onDone,
  onArchive,
}: {
  chore: ChoreRow;
  pending: boolean;
  onDone: () => void;
  onArchive: () => void;
}) {
  return (
    <li className="rounded-xl bg-white p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onDone}
          disabled={pending}
          aria-label={`Mark ${chore.name} done`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-lg text-transparent active:bg-slate-50 disabled:opacity-60"
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{chore.name}</p>
            {chore.overdue && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                Overdue
              </span>
            )}
            {chore.dueToday && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                Due
              </span>
            )}
          </div>
          <p className={`mt-0.5 text-xs ${chore.overdue ? "text-red-600" : "text-slate-400"}`}>
            {dueLabel(chore)} · every {chore.frequencyDays}d
          </p>
        </div>
        <button
          onClick={onArchive}
          disabled={pending}
          className="shrink-0 text-xs font-medium text-slate-400 active:text-slate-600 disabled:opacity-60"
        >
          Archive
        </button>
      </div>
      {chore.notes && <p className="mt-2 pl-14 text-xs text-slate-500">{chore.notes}</p>}
    </li>
  );
}

// --- add chore form --------------------------------------------------------

function AddChoreForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [frequencyDays, setFrequencyDays] = useState<number>(7);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          frequencyDays,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t save chore");
      }
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save chore");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Chore name (e.g. Take out trash)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
        autoFocus
      />

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Frequency</p>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.days}
              type="button"
              onClick={() => setFrequencyDays(f.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                frequencyDays === f.days ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
      />

      {err && <p className="text-xs text-red-600">{err}</p>}

      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Add chore"}
      </button>
    </form>
  );
}

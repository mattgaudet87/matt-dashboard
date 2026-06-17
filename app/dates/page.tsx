"use client";

import { useCallback, useEffect, useState } from "react";
import { relativeDays } from "@/lib/format";
import type { DateRow, DatesResponse, DateUrgency } from "@/lib/types";

const TYPES = ["birthday", "anniversary", "renewal", "event", "reminder"] as const;

const TYPE_EMOJI: Record<string, string> = {
  birthday: "🎂",
  anniversary: "💍",
  renewal: "🔁",
  event: "📅",
  reminder: "⏰",
};

const URGENCY_TONE: Record<DateUrgency, string> = {
  urgent: "text-red-600",
  soon: "text-amber-600",
  normal: "text-slate-400",
};

export default function DatesPage() {
  const [data, setData] = useState<DatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dates", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as DatesResponse);
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

  async function dismiss(d: DateRow) {
    setPending((prev) => new Set(prev).add(d.id));
    try {
      const res = await fetch(`/api/dates/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: 0 }),
      });
      if (res.ok) await load();
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(d.id);
        return next;
      });
    }
  }

  if (loading && !data) {
    return <p className="py-12 text-center text-slate-400">Loading dates…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Couldn’t load your dates.</p>
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
          <h1 className="text-2xl font-bold">Important Dates</h1>
          <p className="text-sm text-slate-500">Birthdays, renewals & reminders</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          {showForm ? "Close" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <AddDateForm
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}

      {data.dates.length === 0 ? (
        <p className="rounded-xl bg-white px-3 py-8 text-center text-sm text-slate-400">
          No dates yet. Add birthdays, anniversaries and renewals.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.dates.map((d) => (
            <DateCard
              key={d.id}
              date={d}
              pending={pending.has(d.id)}
              onDismiss={() => dismiss(d)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// --- date card -------------------------------------------------------------

function DateCard({
  date,
  pending,
  onDismiss,
}: {
  date: DateRow;
  pending: boolean;
  onDismiss: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white p-3">
      <span className="text-xl" aria-hidden>
        {TYPE_EMOJI[date.type] ?? "📅"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{date.title}</p>
          {date.isRecurring === 1 && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
              Yearly
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {date.eventDate} ·{" "}
          <span className={`font-medium ${URGENCY_TONE[date.urgency]}`}>
            {relativeDays(date.daysUntil)}
          </span>
        </p>
      </div>
      <button
        onClick={onDismiss}
        disabled={pending}
        className="shrink-0 text-xs font-medium text-slate-400 active:text-slate-600 disabled:opacity-60"
      >
        Dismiss
      </button>
    </li>
  );
}

// --- add date form ---------------------------------------------------------

function AddDateForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("event");
  const [isRecurring, setIsRecurring] = useState(false);
  const [reminderOffsetDays, setReminderOffsetDays] = useState("7");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventDate) {
      setErr("Title and date are required");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          eventDate,
          type,
          isRecurring,
          reminderOffsetDays: Number(reminderOffsetDays) || 7,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t save date");
      }
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save date");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g. Dad’s birthday)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
        autoFocus
      />

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Type</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                type === t ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {TYPE_EMOJI[t]} {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsRecurring((r) => !r)}
          aria-pressed={isRecurring}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            isRecurring ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          {isRecurring ? "Repeats yearly ✓" : "Repeats yearly"}
        </button>
        <label className="flex flex-1 items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Remind (days before)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={reminderOffsetDays}
            onChange={(e) => setReminderOffsetDays(e.target.value)}
            className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      {err && <p className="text-xs text-red-600">{err}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Add date"}
      </button>
    </form>
  );
}

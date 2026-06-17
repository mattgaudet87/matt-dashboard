"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { BudgetCategoryRow, BudgetResponse } from "@/lib/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Shift a "YYYY-MM" string by ±n months (calendar-safe via UTC).
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function MoneyPage() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<BudgetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (m: string) => {
    try {
      const res = await fetch(`/api/budget?month=${m}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as BudgetResponse);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(month);
  }, [load, month]);

  const isCurrent = month === currentMonth();

  if (loading && !data) {
    return <p className="py-12 text-center text-slate-400">Loading budget…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Couldn’t load your budget.</p>
        <button
          onClick={() => load(month)}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) return null;

  const overBudget = data.totals.remaining < 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Finances</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          disabled={data.categories.length === 0}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {showForm ? "Close" : "+ Spend"}
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between rounded-xl bg-white px-2 py-2">
        <button
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          aria-label="Previous month"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-lg text-slate-500 active:bg-slate-100"
        >
          ‹
        </button>
        <span className="text-sm font-semibold">{monthLabel(data.month)}</span>
        <button
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={isCurrent}
          aria-label="Next month"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-lg text-slate-500 active:bg-slate-100 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {showForm && (
        <LogSpendForm
          categories={data.categories}
          month={data.month}
          onLogged={async () => {
            setShowForm(false);
            await load(month);
          }}
        />
      )}

      {/* Totals */}
      <div className="rounded-xl bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Remaining this month
        </p>
        <p className={`mt-1 text-3xl font-bold ${overBudget ? "text-red-600" : "text-accent"}`}>
          {formatMoney(data.totals.remaining)}
        </p>
        <p className="text-xs text-slate-400">
          {formatMoney(data.totals.spent)} spent of {formatMoney(data.totals.budget)}
        </p>
      </div>

      {/* Categories */}
      {data.categories.length === 0 ? (
        <p className="rounded-xl bg-white px-3 py-8 text-center text-sm text-slate-400">
          No budget categories yet. Add them in Settings.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

// --- category row ----------------------------------------------------------

function CategoryRow({ category }: { category: BudgetCategoryRow }) {
  const pct =
    category.monthlyBudget > 0
      ? Math.min(100, Math.round((category.spent / category.monthlyBudget) * 100))
      : category.spent > 0
        ? 100
        : 0;
  const over = category.overBudget;
  return (
    <li className="rounded-xl bg-white p-3">
      <div className="flex items-baseline justify-between">
        <p className="font-medium">{category.name}</p>
        <p className={`text-sm font-semibold ${over ? "text-red-600" : "text-slate-600"}`}>
          {formatMoney(category.spent)}
          <span className="font-normal text-slate-400"> / {formatMoney(category.monthlyBudget)}</span>
        </p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${over ? "bg-red-500" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`mt-1 text-xs ${over ? "text-red-600" : "text-slate-400"}`}>
        {over
          ? `${formatMoney(-category.remaining)} over budget`
          : `${formatMoney(category.remaining)} left`}
      </p>
    </li>
  );
}

// --- log spend form --------------------------------------------------------

function LogSpendForm({
  categories,
  month,
  onLogged,
}: {
  categories: BudgetCategoryRow[];
  month: string;
  onLogged: () => void;
}) {
  // Default the entry date to today if we're viewing the current month,
  // otherwise the first of the month being viewed.
  const defaultDate = month === currentMonth() ? todayIso() : `${month}-01`;
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 0);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setErr("Enter an amount greater than 0");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/budget/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          amount: Math.round(dollars * 100), // cents
          entryDate: date,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t log spend");
      }
      onLogged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t log spend");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4">
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Category</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                categoryId === c.id ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Amount ($)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
            autoFocus
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
      />

      {err && <p className="text-xs text-red-600">{err}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Log spend"}
      </button>
    </form>
  );
}

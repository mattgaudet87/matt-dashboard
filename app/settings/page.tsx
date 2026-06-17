"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "../providers";
import { formatMoney } from "@/lib/format";
import type {
  BudgetCategoriesResponse,
  BudgetCategory,
  XpResponse,
} from "@/lib/types";

// Friendly labels + accent emoji for each XP action type.
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

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <AccountCard />
      <BudgetCategoriesSection />
      <ManageLinksSection />
      <XpHistorySection />
    </div>
  );
}

// --- account summary -------------------------------------------------------

function AccountCard() {
  const { data } = useDashboard();
  const user = data?.user;
  const progress = user?.progress;

  return (
    <section className="rounded-xl bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">{data?.greeting.name ?? "Matt"}</p>
          <p className="text-xs text-slate-400">Personal life dashboard</p>
        </div>
        <span className="rounded-md bg-accent px-2.5 py-1 text-sm font-semibold text-white">
          Level {user?.level ?? 1}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Total XP" value={`${user?.currentXp ?? 0}`} />
        <Stat label="Streak" value={`${user?.streakCount ?? 0} 🔥`} />
        <Stat
          label="To next level"
          value={progress ? `${progress.xpToNext}` : "—"}
        />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <p className="text-base font-bold">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

// --- budget categories -----------------------------------------------------

function BudgetCategoriesSection() {
  const [categories, setCategories] = useState<BudgetCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/budget/categories", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const body = (await res.json()) as BudgetCategoriesResponse;
      setCategories(body.categories);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Budget categories
        </h2>
        <button
          onClick={() => setAdding((a) => !a)}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
        >
          {adding ? "Close" : "+ Add"}
        </button>
      </div>

      {adding && (
        <CategoryForm
          onSaved={async () => {
            setAdding(false);
            await load();
          }}
        />
      )}

      {error && !categories ? (
        <div className="rounded-xl bg-white px-3 py-6 text-center">
          <p className="text-sm text-slate-500">Couldn’t load categories.</p>
          <button
            onClick={load}
            className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
          >
            Try again
          </button>
        </div>
      ) : !categories ? (
        <p className="rounded-xl bg-white px-3 py-6 text-center text-sm text-slate-400">
          Loading…
        </p>
      ) : categories.length === 0 ? (
        <p className="rounded-xl bg-white px-3 py-6 text-center text-sm text-slate-400">
          No categories yet. Add one to start budgeting.
        </p>
      ) : (
        <ul className="space-y-2">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} onChanged={load} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CategoryRow({
  category,
  onChanged,
}: {
  category: BudgetCategory;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    try {
      await fetch(`/api/budget/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: category.isActive ? 0 : 1 }),
      });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li>
        <CategoryForm
          category={category}
          onSaved={async () => {
            setEditing(false);
            await onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const archived = category.isActive === 0;
  return (
    <li className="flex items-center justify-between rounded-xl bg-white p-3">
      <div className={archived ? "opacity-50" : undefined}>
        <p className="font-medium">
          {category.name}
          {category.kind === "saving" && (
            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
              Savings
            </span>
          )}
          {archived && (
            <span className="ml-2 text-[11px] font-normal text-slate-400">archived</span>
          )}
        </p>
        <p className="text-xs text-slate-400">
          {formatMoney(category.monthlyBudget)}
          {category.kind === "saving" ? " goal / month" : " / month"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg px-3 py-2 text-xs font-medium text-accent active:bg-slate-100"
        >
          Edit
        </button>
        <button
          onClick={toggleActive}
          disabled={busy}
          className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 active:bg-slate-100 disabled:opacity-50"
        >
          {archived ? "Restore" : "Archive"}
        </button>
      </div>
    </li>
  );
}

function CategoryForm({
  category,
  onSaved,
  onCancel,
}: {
  category?: BudgetCategory;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  // Stored in cents; edited in dollars.
  const [amount, setAmount] = useState(
    category ? String(category.monthlyBudget / 100) : "",
  );
  const [kind, setKind] = useState<"spend" | "saving">(category?.kind ?? "spend");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Enter a category name");
      return;
    }
    const dollars = Number(amount || "0");
    if (!Number.isFinite(dollars) || dollars < 0) {
      setErr("Enter a valid budget amount");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const monthlyBudget = Math.round(dollars * 100);
      const res = await fetch(
        category ? `/api/budget/categories/${category.id}` : "/api/budget/categories",
        {
          method: category ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, monthlyBudget, kind }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t save category");
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-2 space-y-3 rounded-xl bg-white p-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Groceries"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
          autoFocus
        />
      </label>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Type</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setKind("spend")}
            aria-pressed={kind === "spend"}
            className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              kind === "spend" ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Spending
          </button>
          <button
            type="button"
            onClick={() => setKind("saving")}
            aria-pressed={kind === "saving"}
            className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              kind === "saving" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Savings
          </button>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          {kind === "saving" ? "Monthly savings goal ($)" : "Monthly budget ($)"}
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      {err && <p className="text-xs text-red-600">{err}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : category ? "Save changes" : "Add category"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 active:bg-slate-100"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// --- manage links ----------------------------------------------------------

function ManageLinksSection() {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Manage
      </h2>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white">
        <ManageLink href="/habits" label="Habits" hint="Add, edit, archive habits" />
        <ManageLink href="/chores" label="Chores" hint="Recurring chores" />
        <ManageLink href="/dates" label="Important dates" hint="Birthdays & reminders" />
      </ul>
    </section>
  );
}

function ManageLink({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-[56px] items-center justify-between px-4 py-3 active:bg-slate-50"
      >
        <span>
          <span className="block font-medium">{label}</span>
          <span className="block text-xs text-slate-400">{hint}</span>
        </span>
        <span aria-hidden className="text-lg text-slate-300">
          ›
        </span>
      </Link>
    </li>
  );
}

// --- XP history ------------------------------------------------------------

function XpHistorySection() {
  const [data, setData] = useState<XpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/xp", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as XpResponse);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        XP history
      </h2>

      {error && !data ? (
        <div className="rounded-xl bg-white px-3 py-6 text-center">
          <p className="text-sm text-slate-500">Couldn’t load XP history.</p>
          <button
            onClick={load}
            className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
          >
            Try again
          </button>
        </div>
      ) : !data ? (
        <p className="rounded-xl bg-white px-3 py-6 text-center text-sm text-slate-400">
          Loading…
        </p>
      ) : data.recent.length === 0 ? (
        <p className="rounded-xl bg-white px-3 py-8 text-center text-sm text-slate-400">
          No XP earned yet. Complete something on Today to get started.
        </p>
      ) : (
        <>
          {/* Lifetime breakdown by action type */}
          <div className="mb-3 rounded-xl bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Lifetime XP
            </p>
            <p className="mt-1 text-3xl font-bold text-accent">{data.total}</p>
            <ul className="mt-3 space-y-1.5">
              {data.byType
                .slice()
                .sort((a, b) => b.xp - a.xp)
                .map((t) => {
                  const meta = actionMeta(t.actionType);
                  return (
                    <li
                      key={t.actionType}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-600">
                        <span aria-hidden className="mr-1.5">
                          {meta.icon}
                        </span>
                        {meta.label}
                        <span className="text-slate-400"> · {t.count}</span>
                      </span>
                      <span className="font-semibold text-slate-700">{t.xp} XP</span>
                    </li>
                  );
                })}
            </ul>
          </div>

          {/* Recent ledger */}
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white">
            {data.recent.map((entry) => {
              const meta = actionMeta(entry.actionType);
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="text-slate-600">
                    <span aria-hidden className="mr-1.5">
                      {meta.icon}
                    </span>
                    {meta.label}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {formatLedgerDate(entry.createdAt)}
                    </span>
                    <span className="font-semibold text-accent">+{entry.xpAwarded}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

// xp_log.createdAt is "YYYY-MM-DD HH:MM:SS" (SQLite CURRENT_TIMESTAMP, UTC).
function formatLedgerDate(raw: string): string {
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

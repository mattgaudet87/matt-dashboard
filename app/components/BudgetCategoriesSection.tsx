"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card } from "./ui";
import { formatMoney } from "@/lib/format";
import type { BudgetCategoriesResponse, BudgetCategory } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-dim focus:border-accent";

export default function BudgetCategoriesSection() {
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
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <h2 className="text-[15px] font-semibold text-ink">Budget Categories</h2>
        <button
          onClick={() => setAdding((a) => !a)}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
        >
          {adding ? "Close" : "+ Add"}
        </button>
      </div>

      {adding && (
        <div className="mb-2.5">
          <CategoryForm
            onSaved={async () => {
              setAdding(false);
              await load();
            }}
          />
        </div>
      )}

      {error && !categories ? (
        <Card>
          <p className="text-center text-sm text-muted">Couldn’t load categories.</p>
          <button
            onClick={load}
            className="mx-auto mt-2 block rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
          >
            Try again
          </button>
        </Card>
      ) : !categories ? (
        <Card>
          <p className="text-center text-sm text-muted">Loading…</p>
        </Card>
      ) : categories.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-muted">
            No categories yet. Add one to start budgeting.
          </p>
        </Card>
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
    <li>
      <Card className="flex items-center justify-between !p-3">
        <div className={archived ? "opacity-50" : undefined}>
          <p className="font-medium text-ink">
            {category.name}
            {category.kind === "saving" && (
              <Badge tone="good" className="ml-2">
                Savings
              </Badge>
            )}
            {archived && (
              <span className="ml-2 text-[11px] font-normal text-dim">archived</span>
            )}
          </p>
          <p className="text-xs text-muted">
            {formatMoney(category.monthlyBudget)}
            {category.kind === "saving" ? " goal / month" : " / month"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg px-3 py-2 text-xs font-medium text-accent active:bg-surface-2"
          >
            Edit
          </button>
          <button
            onClick={toggleActive}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-xs font-medium text-muted active:bg-surface-2 disabled:opacity-50"
          >
            {archived ? "Restore" : "Archive"}
          </button>
        </div>
      </Card>
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
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Groceries"
            className={inputCls}
            autoFocus
          />
        </label>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Type</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind("spend")}
              aria-pressed={kind === "spend"}
              className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                kind === "spend" ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              Spending
            </button>
            <button
              type="button"
              onClick={() => setKind("saving")}
              aria-pressed={kind === "saving"}
              className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                kind === "saving" ? "bg-emerald text-white" : "bg-surface-2 text-muted"
              }`}
            >
              Savings
            </button>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
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
            className={inputCls}
          />
        </label>

        {err && <p className="text-xs text-coral">{err}</p>}

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
              className="rounded-lg bg-surface-2 px-4 py-2.5 text-sm font-medium text-muted"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}

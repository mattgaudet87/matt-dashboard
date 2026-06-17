"use client";

import Link from "next/link";
import BudgetCategoriesSection from "../../components/BudgetCategoriesSection";

// Budget category management lives on its own page, reached from Money.
export default function BudgetCategoriesPage() {
  return (
    <div className="animate-screen space-y-4">
      <Link
        href="/money"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted active:text-ink"
      >
        ‹ Back to Money
      </Link>
      <BudgetCategoriesSection />
    </div>
  );
}

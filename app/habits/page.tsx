import { redirect } from "next/navigation";

// Habits merged into the Grow tab (redesign IA). Keep the old URL working.
export default function HabitsRedirect() {
  redirect("/grow");
}

import { redirect } from "next/navigation";

// Health merged into the Grow tab (redesign IA). Keep the old URL working.
export default function HealthRedirect() {
  redirect("/grow");
}

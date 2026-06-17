import { redirect } from "next/navigation";

// XP history merged into the Me tab (redesign IA). Keep the old URL working.
export default function XpRedirect() {
  redirect("/me");
}

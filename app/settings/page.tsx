import { redirect } from "next/navigation";

// Settings merged into the Me tab (redesign IA). Keep the old URL working.
export default function SettingsRedirect() {
  redirect("/me");
}

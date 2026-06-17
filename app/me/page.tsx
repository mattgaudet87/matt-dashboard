"use client";

import SettingsPage from "../settings/page";

// "Me" merges XP and Settings (redesign IA). Phase 2 reuses the existing
// Settings screen (account, XP history, manage links, budget categories).
// Phase 6 rebuilds this with the level ring + XP-over-time chart.
export default function MePage() {
  return (
    <div className="animate-screen">
      <SettingsPage />
    </div>
  );
}

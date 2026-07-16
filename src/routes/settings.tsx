import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Divakar Tea Shop" }] }),
});

const ROWS = [
  { label: "Shop details", hint: "Divakar Tea Shop" },
  { label: "Language", hint: "English" },
  { label: "Backup & sync", hint: "Cloud connected" },
  { label: "Staff & roles", hint: "Manage access" },
  { label: "About", hint: "v0.1.0" },
];

function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Preferences and shop info" showFab={false}>
      <div className="solid-card divide-y divide-border overflow-hidden">
        {ROWS.map((r) => (
          <button
            key={r.label}
            type="button"
            className="press flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.hint}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/grocery")({
  component: GroceryPage,
  head: () => ({ meta: [{ title: "Grocery — Divakar Tea Shop" }] }),
});

function GroceryPage() {
  return (
    <AppShell title="Grocery" subtitle="Daily shopping list">
      <div className="solid-card mb-4 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today's list
        </p>
        <p className="mono-amount mt-1 text-3xl text-secondary">₹0</p>
        <p className="text-xs text-muted-foreground">Budget not set</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {["All", "To buy", "Bought"].map((f, i) => (
          <button
            key={f}
            type="button"
            className={[
              "press pill px-4 py-1.5 text-xs font-semibold",
              i === 0 ? "gradient-warm" : "border border-border bg-card text-foreground",
            ].join(" ")}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="solid-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No items yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">Tap + to add grocery items.</p>
      </div>
    </AppShell>
  );
}

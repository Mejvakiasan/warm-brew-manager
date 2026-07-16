import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Search } from "lucide-react";

export const Route = createFileRoute("/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Customers — Divakar Tea Shop" }] }),
});

const FILTERS = ["All", "Unpaid", "Partial", "Paid"];

function CustomersPage() {
  return (
    <AppShell title="Customers" subtitle="Accounts and balances">
      <div className="solid-card mb-4 flex items-center gap-2 px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or phone"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <button
            key={f}
            type="button"
            className={[
              "press pill px-4 py-1.5 text-xs font-semibold",
              i === 0
                ? "gradient-warm"
                : "border border-border bg-card text-foreground",
            ].join(" ")}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="solid-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No customers yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tap the + button to add your first customer.
        </p>
      </div>
    </AppShell>
  );
}

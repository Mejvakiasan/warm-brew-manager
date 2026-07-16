import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { TrendingUp, Wallet, HandCoins, Package } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

type Stat = {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "secondary";
};

const STATS: Stat[] = [
  { label: "Today's Sales", value: "₹0", hint: "0 transactions", icon: TrendingUp, tone: "primary" },
  { label: "Cash Collected", value: "₹0", hint: "today", icon: Wallet, tone: "secondary" },
  { label: "Owed by Customers", value: "₹0", hint: "across all accounts", icon: HandCoins, tone: "primary" },
  { label: "Current Stock Value", value: "₹0", hint: "0 products", icon: Package, tone: "secondary" },
];

function Dashboard() {
  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <AppShell title="Divakar Tea Shop" subtitle={dateStr}>
      <div className="grid grid-cols-2 gap-3">
        {STATS.map((s) => (
          <div key={s.label} className="glass press p-4">
            <div
              className={[
                "grid h-9 w-9 place-items-center rounded-full",
                s.tone === "primary" ? "gradient-warm" : "bg-secondary text-secondary-foreground",
              ].join(" ")}
            >
              <s.icon className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
            <p className="mono-amount mt-1 text-2xl text-secondary">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-secondary">Quick actions</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {["New sale", "Record payment", "Add stock", "New grocery"].map((a) => (
            <button
              key={a}
              type="button"
              className="press pill border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
            >
              {a}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-bold text-secondary">Recent activity</h2>
        <div className="solid-card p-5 text-sm text-muted-foreground">
          No activity yet. Your latest sales and payments will show here.
        </div>
      </section>
    </AppShell>
  );
}

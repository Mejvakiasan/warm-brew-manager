import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Package } from "lucide-react";

export const Route = createFileRoute("/stock")({
  component: StockPage,
  head: () => ({ meta: [{ title: "Stock — Divakar Tea Shop" }] }),
});

function StockPage() {
  return (
    <AppShell title="Stock" subtitle="Products and inventory">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass press p-4">
            <div className="grid aspect-square place-items-center rounded-xl bg-muted/60">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-semibold">Product name</p>
            <p className="text-xs text-muted-foreground">0 kg</p>
            <p className="mono-amount mt-1 text-lg text-secondary">₹0</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Placeholder cards. Real products will appear here.
      </p>
    </AppShell>
  );
}

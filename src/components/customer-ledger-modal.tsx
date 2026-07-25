import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, ChevronRight, Phone, Trash2, Search, X, CheckCircle2, Circle, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/format";
import { CustomerLedgerModal } from "@/components/customer-ledger-modal";
import { SupabaseLedgerProvider } from "@/integrations/ledger-provider";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Customers — Divakar Tea Shop" }] }),
});

type Customer = Tables<"customers">;

function CustomersPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");
  const [settleExpandedId, setSettleExpandedId] = useState<string | null>(null);
  const [settlePartialAmount, setSettlePartialAmount] = useState("");
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Create ledger provider (Supabase)
  const ledgerProvider = useMemo(() => new SupabaseLedgerProvider(supabase), []);

  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ["customers"],
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addCustomer = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required");
      const { data, error } = await supabase
        .from("customers")
        .insert({ name: trimmed, phone: phone.trim() || null })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Customer added");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setName("");
      setPhone("");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Could not add customer"),
  });

   const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer removed");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove customer"),
  });

  const settleBalance = useMutation({
    mutationFn: async ({ customer, amount }: { customer: Customer; amount: number }) => {
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      const { error } = await supabase.from("payments").insert({
        customer_id: customer.id,
        date: new Date().toISOString().slice(0, 10),
        amount_paid: amount,
      });
      if (error) throw error;
      return amount;
    },
    onSuccess: (amount, { customer }) => {
      toast.success(`${formatCurrency(amount)} recorded for ${customer.name}`);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSettleExpandedId(null);
      setSettlePartialAmount("");
    },
    onError: (e: Error) => toast.error(e.message || "Could not record payment"),
  });

  const totalOwed = customers.reduce((sum, c) => sum + Number(c.balance), 0);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <AppShell title="Customers" subtitle="Accounts and balances" showFab={false}>
      <div className="solid-card mb-4 flex items-center justify-between p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total outstanding
          </p>
          <p className="mono-amount mt-1 text-2xl text-secondary">
            {formatCurrency(totalOwed)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Customers
          </p>
          <p className="mono-amount mt-1 text-2xl text-secondary">{customers.length}</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          autoComplete="off"
          className="h-12 w-full rounded-2xl border border-input bg-card pl-10 pr-10 text-sm outline-none focus:border-primary"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearch("")}
            className="press absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-muted/70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isLoading && (
        <div className="solid-card p-6 text-center text-sm text-muted-foreground">
          Loading customers…
        </div>
      )}
      {error && (
        <div className="solid-card p-6 text-center text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      {!isLoading && customers.length === 0 && (
        <div className="solid-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No customers yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap the + button to add your first customer.
          </p>
        </div>
      )}

      {!isLoading && customers.length > 0 && filteredCustomers.length === 0 && (
        <div className="solid-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No customers match "{search}".</p>
        </div>
      )}

      <div className="space-y-2">
        {filteredCustomers.map((c) => (
          <div key={c.id} className="solid-card p-4">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setSelectedCustomer({ id: c.id, name: c.name });
                  setLedgerOpen(true);
                }}
                className="press min-w-0 flex-1 text-left hover:opacity-80"
              >
                <p className="truncate text-base font-semibold text-foreground">{c.name}</p>
                {c.phone && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {c.phone}
                  </p>
                )}
              </button>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Balance
                  </p>
                  <p
                    className={[
                      "mono-amount text-lg",
                      Number(c.balance) > 0 ? "text-secondary" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {formatCurrency(Number(c.balance))}
                  </p>
                </div>

                {Number(c.balance) > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSettleExpandedId(settleExpandedId === c.id ? null : c.id)
                    }
                    className="pill press bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive"
                  >
                    Unpaid
                  </button>
                ) : (
                  <span className="pill inline-flex items-center gap-1 bg-[oklch(0.65_0.15_150/0.15)] px-2.5 py-1 text-[11px] font-semibold text-[oklch(0.5_0.15_150)]">
                    <CheckCircle2 className="h-3 w-3" /> Paid
                  </span>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete ${c.name}? This removes their record and all transaction/payment history. This can't be undone.`,
                        )
                      ) {
                        deleteCustomer.mutate(c.id);
                      }
                    }}
                    className="press grid h-8 w-8 flex-none place-items-center rounded-full bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                )}

                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {settleExpandedId === c.id && (
              <div className="mt-3 flex gap-2 border-t border-border/60 pt-3">
                <button
                  type="button"
                  disabled={settleBalance.isPending}
                  onClick={() =>
                    settleBalance.mutate({ customer: c, amount: Number(c.balance) })
                  }
                  className="press flex h-10 flex-1 items-center justify-center gap-1 rounded-xl gradient-warm text-xs font-semibold text-primary-foreground"
                >
                  <CheckCircle2 className="h-4 w-4" /> Mark Paid ({formatCurrency(Number(c.balance))})
                </button>
                <button
                  type="button"
                  disabled={settleBalance.isPending}
                  onClick={() => {
                    setSettlePartialAmount(String(c.balance));
                    setSettleExpandedId(`partial-${c.id}`);
                  }}
                  className="press flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-secondary/15 text-xs font-semibold text-secondary"
                >
                  <Circle className="h-4 w-4" /> Mark Partial
                </button>
              </div>
            )}

            {settleExpandedId === `partial-${c.id}` && (
              <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
                <Input
                  value={settlePartialAmount}
                  onChange={(e) => setSettlePartialAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="Amount paid"
                  className="h-10 flex-1"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={settleBalance.isPending || !Number(settlePartialAmount)}
                  onClick={() =>
                    settleBalance.mutate({ customer: c, amount: Number(settlePartialAmount) })
                  }
                  className="press grid h-10 w-10 flex-none place-items-center rounded-xl gradient-warm text-primary-foreground"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettleExpandedId(null);
                    setSettlePartialAmount("");
                  }}
                  className="press grid h-10 w-10 flex-none place-items-center rounded-xl bg-muted/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add customer"
        className="press fixed right-5 bottom-24 z-40 grid h-14 w-14 place-items-center rounded-full gradient-warm shadow-(--shadow-pop)"
      >
        <Plus className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">Add customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-name">Name</Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh"
                className="h-12"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">Phone (optional)</Label>
              <Input
                id="c-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91…"
                inputMode="tel"
                className="h-12"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addCustomer.mutate()}
              disabled={addCustomer.isPending || !name.trim()}
              className="press h-12 w-full rounded-2xl gradient-warm text-base font-semibold"
            >
              {addCustomer.isPending ? "Adding…" : "Add customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCustomer && (
        <CustomerLedgerModal
          open={ledgerOpen}
          onOpenChange={setLedgerOpen}
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          provider={ledgerProvider}
          onBalanceChange={() => {
            queryClient.invalidateQueries({ queryKey: ["customers"] });
          }}
        />
      )}
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, ChevronRight, Phone, Trash2 } from "lucide-react";
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

  const totalOwed = customers.reduce((sum, c) => sum + Number(c.balance), 0);

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

      <div className="space-y-2">
        {customers.map((c) => (
          <div
            key={c.id}
            className="press solid-card flex items-center justify-between gap-3 p-4"
          >
            <button
              onClick={() => {
                setSelectedCustomer({ id: c.id, name: c.name });
                setLedgerOpen(true);
              }}
              className="min-w-0 flex-1 text-left hover:opacity-80"
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

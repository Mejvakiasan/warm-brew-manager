import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Phone,
  Plus,
  Trash2,
  Pencil,
  Receipt,
  Wallet,
} from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/customers/$id")({
  component: CustomerDetailPage,
  head: () => ({ meta: [{ title: "Customer — Divakar Tea Shop" }] }),
});

type Customer = Tables<"customers">;
type Transaction = Tables<"transactions">;
type Payment = Tables<"payments">;
type Status = "unpaid" | "partial" | "paid";

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();

  const customerQ = useQuery({
    queryKey: ["customer", id],
    queryFn: async (): Promise<Customer | null> => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const txQ = useQuery({
    queryKey: ["transactions", id],
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("customer_id", id)
        .order("date_time", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const payQ = useQuery({
    queryKey: ["payments", id],
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("customer_id", id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["customer", id] });
    queryClient.invalidateQueries({ queryKey: ["transactions", id] });
    queryClient.invalidateQueries({ queryKey: ["payments", id] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
  };

  // Dialogs
  const [txOpen, setTxOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editPay, setEditPay] = useState<Payment | null>(null);
  const [deleteCustomerOpen, setDeleteCustomerOpen] = useState(false);

  const deleteCustomer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer deleted");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate({ to: "/customers", replace: true });
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete"),
  });

  const customer = customerQ.data;

  return (
    <div className="min-h-screen pb-28">
      <header className="px-5 pt-8 pb-5">
        <div className="mb-3 flex items-center justify-between">
          <Link
            to="/customers"
            className="press pill inline-flex items-center gap-1 border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Customers
          </Link>
          {isAdmin && customer && (
            <button
              type="button"
              onClick={() => setDeleteCustomerOpen(true)}
              className="press pill inline-flex items-center gap-1 border border-destructive/30 bg-card px-3 py-1.5 text-xs font-semibold text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>

        {customerQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {customerQ.error && (
          <p className="text-sm text-destructive">{(customerQ.error as Error).message}</p>
        )}
        {customer && (
          <>
            <h1 className="font-display text-3xl font-extrabold text-secondary">
              {customer.name}
            </h1>
            {customer.phone && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {customer.phone}
              </p>
            )}
          </>
        )}
      </header>

      <main className="px-5">
        {customer && (
          <div className="solid-card mb-5 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Outstanding balance
            </p>
            <p
              className={[
                "mono-amount mt-1 text-4xl",
                Number(customer.balance) > 0 ? "text-secondary" : "text-muted-foreground",
              ].join(" ")}
            >
              {formatCurrency(Number(customer.balance))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Auto-calculated from transactions and payments.
            </p>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTxOpen(true)}
            className="press solid-card flex items-center gap-3 p-4 text-left"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full gradient-warm">
              <Receipt className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">New transaction</p>
              <p className="text-[11px] text-muted-foreground">Add a sale</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="press solid-card flex items-center gap-3 p-4 text-left"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Record payment</p>
              <p className="text-[11px] text-muted-foreground">Reduce balance</p>
            </div>
          </button>
        </div>

        <section className="mb-6">
          <h2 className="mb-3 font-display text-lg font-bold text-secondary">Transactions</h2>
          <div className="solid-card divide-y divide-border p-0">
            {txQ.isLoading && (
              <p className="p-5 text-sm text-muted-foreground">Loading…</p>
            )}
            {txQ.data && txQ.data.length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">No transactions yet.</p>
            )}
            {txQ.data?.map((t) => (
              <TransactionRow
                key={t.id}
                tx={t}
                isAdmin={isAdmin}
                onEdit={() => setEditTx(t)}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-secondary">Payments</h2>
          <div className="solid-card divide-y divide-border p-0">
            {payQ.isLoading && (
              <p className="p-5 text-sm text-muted-foreground">Loading…</p>
            )}
            {payQ.data && payQ.data.length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">No payments yet.</p>
            )}
            {payQ.data?.map((p) => (
              <PaymentRow
                key={p.id}
                pay={p}
                isAdmin={isAdmin}
                onEdit={() => setEditPay(p)}
              />
            ))}
          </div>
        </section>
      </main>

      <TransactionDialog
        open={txOpen || !!editTx}
        onOpenChange={(o) => {
          if (!o) {
            setTxOpen(false);
            setEditTx(null);
          }
        }}
        customerId={id}
        userId={user?.id ?? null}
        isAdmin={isAdmin}
        existing={editTx}
        onDone={() => {
          invalidateAll();
          setTxOpen(false);
          setEditTx(null);
        }}
      />

      <PaymentDialog
        open={payOpen || !!editPay}
        onOpenChange={(o) => {
          if (!o) {
            setPayOpen(false);
            setEditPay(null);
          }
        }}
        customerId={id}
        userId={user?.id ?? null}
        isAdmin={isAdmin}
        existing={editPay}
        onDone={() => {
          invalidateAll();
          setPayOpen(false);
          setEditPay(null);
        }}
      />

      <AlertDialog open={deleteCustomerOpen} onOpenChange={setDeleteCustomerOpen}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              All transactions and payments for this customer will also be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCustomer.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function statusPill(status: string) {
  const s = status as Status;
  const map: Record<Status, string> = {
    unpaid: "bg-destructive/10 text-destructive",
    partial: "bg-warning/20 text-secondary",
    paid: "bg-success/15 text-secondary",
  };
  return map[s] ?? "bg-muted text-muted-foreground";
}

function TransactionRow({
  tx,
  isAdmin,
  onEdit,
}: {
  tx: Transaction;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const d = new Date(tx.date_time);
  const dateStr = d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {tx.product || "Sale"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{dateStr}</p>
        <span
          className={[
            "pill mt-2 inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            statusPill(tx.status),
          ].join(" ")}
        >
          {tx.status}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <p className="mono-amount text-base text-secondary">
          {formatCurrency(Number(tx.amount))}
        </p>
        {isAdmin && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit transaction"
            className="press grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-muted-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function PaymentRow({
  pay,
  isAdmin,
  onEdit,
}: {
  pay: Payment;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const dateStr = new Date(pay.date + "T00:00:00").toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-semibold">Payment received</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{dateStr}</p>
      </div>
      <div className="flex items-center gap-2">
        <p className="mono-amount text-base text-success">
          − {formatCurrency(Number(pay.amount_paid))}
        </p>
        {isAdmin && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit payment"
            className="press grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-muted-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function TransactionDialog({
  open,
  onOpenChange,
  customerId,
  userId,
  isAdmin,
  existing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerId: string;
  userId: string | null;
  isAdmin: boolean;
  existing: Transaction | null;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [product, setProduct] = useState("");
  const [status, setStatus] = useState<Status>("unpaid");

  // Reset when opening/editing changes
  useResetOnOpen(open, () => {
    if (existing) {
      setAmount(String(existing.amount));
      setProduct(existing.product ?? "");
      setStatus((existing.status as Status) ?? "unpaid");
    } else {
      setAmount("");
      setProduct("");
      setStatus("unpaid");
    }
  });

  const save = useMutation({
    mutationFn: async () => {
      const num = Number(amount);
      if (!Number.isFinite(num) || num <= 0) throw new Error("Enter a valid amount");
      if (existing) {
        const { error } = await supabase
          .from("transactions")
          .update({
            amount: num,
            product: product.trim() || null,
            status,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert({
          customer_id: customerId,
          amount: num,
          product: product.trim() || null,
          status,
          created_by: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(existing ? "Transaction updated" : "Transaction added");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!existing) return;
      const { error } = await supabase.from("transactions").delete().eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction deleted");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">
            {existing ? "Edit transaction" : "New transaction"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tx-amount">Amount</Label>
            <Input
              id="tx-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mono-amount h-12 text-lg"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-product">Product (optional)</Label>
            <Input
              id="tx-product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g. 2 chai, 1 samosa"
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {existing && isAdmin ? (
            <Button
              variant="outline"
              onClick={() => del.mutate()}
              disabled={del.isPending}
              className="press h-12 rounded-2xl border-destructive/30 text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !amount || (!!existing && !isAdmin)}
            className="press h-12 flex-1 rounded-2xl gradient-warm text-base font-semibold"
          >
            {save.isPending ? "Saving…" : existing ? "Save changes" : "Add transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  customerId,
  userId,
  isAdmin,
  existing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerId: string;
  userId: string | null;
  isAdmin: boolean;
  existing: Payment | null;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useResetOnOpen(open, () => {
    if (existing) {
      setAmount(String(existing.amount_paid));
      setDate(existing.date);
    } else {
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
    }
  });

  const save = useMutation({
    mutationFn: async () => {
      const num = Number(amount);
      if (!Number.isFinite(num) || num <= 0) throw new Error("Enter a valid amount");
      if (existing) {
        const { error } = await supabase
          .from("payments")
          .update({ amount_paid: num, date })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payments").insert({
          customer_id: customerId,
          amount_paid: num,
          date,
          created_by: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(existing ? "Payment updated" : "Payment recorded");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!existing) return;
      const { error } = await supabase.from("payments").delete().eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment deleted");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">
            {existing ? "Edit payment" : "Record payment"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Amount paid</Label>
            <Input
              id="pay-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mono-amount h-12 text-lg"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-date">Date</Label>
            <Input
              id="pay-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {existing && isAdmin ? (
            <Button
              variant="outline"
              onClick={() => del.mutate()}
              disabled={del.isPending}
              className="press h-12 rounded-2xl border-destructive/30 text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !amount || (!!existing && !isAdmin)}
            className="press h-12 flex-1 rounded-2xl gradient-warm text-base font-semibold"
          >
            {save.isPending ? "Saving…" : existing ? "Save changes" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// small helper: run reset when dialog transitions to open
function useResetOnOpen(open: boolean, reset: () => void) {
  const prev = useRef(false);
  useEffect(() => {
    if (open && !prev.current) reset();
    prev.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

void Plus;


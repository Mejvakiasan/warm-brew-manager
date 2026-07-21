import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Delete, X, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/calculator")({
  component: CalculatorPage,
  head: () => ({ meta: [{ title: "Calculator — Divakar Tea Shop" }] }),
});

type Customer = Tables<"customers">;
type Mode = "customer" | "independent";

const KEYS: (string | { label: string; kind: "op" | "eq" | "clear" | "del" })[] = [
  "7", "8", "9", { label: "÷", kind: "op" },
  "4", "5", "6", { label: "×", kind: "op" },
  "1", "2", "3", { label: "−", kind: "op" },
  { label: "C", kind: "clear" }, "0", ".", { label: "+", kind: "op" },
];

function CalculatorPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("customer");
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("0");

  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data: customers = [] } = useQuery({
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

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers.slice(0, 6);
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [search, customers]);

  const exactMatch = useMemo(
    () => customers.some((c) => c.name.trim().toLowerCase() === search.trim().toLowerCase()),
    [customers, search],
  );

  const addCustomer = useMutation({
    mutationFn: async () => {
      const trimmed = search.trim();
      if (!trimmed) throw new Error("Name is required");
      const { data, error } = await supabase
        .from("customers")
        .insert({ name: trimmed })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Customer added");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (data) {
        setSelectedCustomer(data);
        setSearch(data.name);
        setShowSuggestions(false);
      }
    },
    onError: (e: Error) => toast.error(e.message || "Could not add customer"),
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer) throw new Error("Select a customer first");
      const amount = Number(result);
      if (!amount || amount <= 0) throw new Error("Calculate an amount first");
      const { error } = await supabase.from("transactions").insert({
        customer_id: selectedCustomer.id,
        amount,
        date_time: new Date().toISOString(),
        status: "unpaid",
      });
      if (error) throw error;
      return amount;
    },
    onSuccess: (amount) => {
      toast.success(`${formatCurrency(amount)} added to ${selectedCustomer?.name}`);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      // reset for next customer
      setExpr("");
      setResult("0");
      setSearch("");
      setSelectedCustomer(null);
    },
    onError: (e: Error) => toast.error(e.message || "Could not add entry"),
  });

  const evalExpr = (e: string) => {
    try {
      const cleaned = e.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
      if (!cleaned) return "0";
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${cleaned})`)();
      return String(Math.round(Number(v) * 100) / 100);
    } catch {
      return result;
    }
  };

  const push = (s: string) => {
    const next = expr + s;
    setExpr(next);
    setResult(evalExpr(next));
  };

  const canAdd = !!selectedCustomer && Number(result) > 0 && !addEntry.isPending;

  return (
    <AppShell title="Calculator" subtitle="Quick counter math" showFab={false}>
      {/* Mode toggle */}
      <div className="mb-4 flex rounded-2xl bg-muted/60 p-1">
        {([
          ["customer", "Customer"],
          ["independent", "Independent"],
        ] as [Mode, string][]).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={[
              "press flex-1 rounded-xl py-2 text-sm font-semibold",
              mode === m
                ? "gradient-warm text-primary-foreground"
                : "text-muted-foreground",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Customer search — only in Customer mode */}
      {mode === "customer" && (
        <div className="relative mb-4">
          {selectedCustomer ? (
            <div className="solid-card flex items-center justify-between p-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Adding to</p>
                <p className="text-sm font-semibold text-foreground">{selectedCustomer.name}</p>
              </div>
              <button
                type="button"
                aria-label="Clear customer"
                onClick={() => {
                  setSelectedCustomer(null);
                  setSearch("");
                }}
                className="press grid h-8 w-8 place-items-center rounded-full bg-muted/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Type customer name…"
                autoComplete="off"
                className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-sm outline-none focus:border-primary"
              />
              {showSuggestions && (
                <div className="glass absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-y-auto p-1.5">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setSearch(c.name);
                        setShowSuggestions(false);
                      }}
                      className="press flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/70"
                    >
                      <span className="text-foreground">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(Number(c.balance))}
                      </span>
                    </button>
                  ))}
                  {search.trim() && !exactMatch && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addCustomer.mutate()}
                      disabled={addCustomer.isPending}
                      className="press flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-secondary hover:bg-muted/70"
                    >
                      <UserPlus className="h-4 w-4" />
                      {addCustomer.isPending
                        ? "Adding…"
                        : `Add "${search.trim()}" as new customer`}
                    </button>
                  )}
                  {filteredCustomers.length === 0 && !search.trim() && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      No customers yet — type a name to add one.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="glass p-6">
        <p className="min-h-6 text-right text-sm text-muted-foreground break-all">{expr || " "}</p>
        <p className="mono-amount mt-2 text-right text-5xl text-secondary">{result}</p>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3">
        {KEYS.map((k, i) => {
          if (typeof k === "string") {
            return (
              <button
                key={i}
                type="button"
                onClick={() => push(k)}
                className="press pill h-16 bg-card text-xl font-semibold text-foreground shadow-[var(--shadow-soft)]"
              >
                {k}
              </button>
            );
          }
          const styles =
            k.kind === "op"
              ? "gradient-warm text-primary-foreground"
              : k.kind === "clear"
              ? "bg-secondary text-secondary-foreground"
              : "bg-card text-foreground";
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (k.kind === "clear") { setExpr(""); setResult("0"); return; }
                if (k.kind === "op") push(k.label);
              }}
              className={`press pill h-16 text-xl font-bold shadow-[var(--shadow-soft)] ${styles}`}
            >
              {k.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setExpr((e) => e.slice(0, -1))}
          className="press pill col-span-2 h-14 border border-border bg-card text-sm font-semibold"
        >
          <Delete className="mx-auto h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => { const v = evalExpr(expr); setExpr(v); setResult(v); }}
          className="press pill col-span-2 h-14 gradient-warm text-lg font-bold"
        >
          =
        </button>
      </div>

      {mode === "customer" && (
        <button
          type="button"
          onClick={() => addEntry.mutate()}
          disabled={!canAdd}
          className={[
            "press mt-4 h-14 w-full rounded-2xl text-base font-semibold",
            canAdd
              ? "gradient-warm text-primary-foreground"
              : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {addEntry.isPending
            ? "Adding…"
            : selectedCustomer
            ? `Add to ${selectedCustomer.name}`
            : "Select a customer first"}
        </button>
      )}
    </AppShell>
  );
}

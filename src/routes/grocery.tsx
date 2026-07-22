import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Minus, Trash2, Check, Pencil, X, ChevronDown, CheckCircle2, XCircle, Flag, Share2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/grocery")({
  component: GroceryPage,
  head: () => ({ meta: [{ title: "Grocery — Divakar Tea Shop" }] }),
});

type GroceryList = Tables<"grocery_lists">;
type GroceryItem = Tables<"grocery_items">;
type Tab = "todo" | "skipped" | "history";

const UNITS = ["kg", "g", "litre", "ml", "piece", "packet", "box", "dozen"];
const todayISO = () => new Date().toISOString().slice(0, 10);
const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
const step = (unit: string) => (unit === "kg" || unit === "litre" ? 1 : 1);

function GroceryPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("todo");

  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  const [itemOpen, setItemOpen] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemUnit, setItemUnit] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [todoOpen, setTodoOpen] = useState(true);

  // Today's list (create-on-demand)
  const { data: todayList, isLoading: listLoading } = useQuery({
    queryKey: ["grocery-list", todayISO()],
    queryFn: async (): Promise<GroceryList | null> => {
      const { data, error } = await supabase
        .from("grocery_lists")
        .select("*")
        .eq("date", todayISO())
        .eq("completed", false)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["grocery-items", todayList?.id],
    enabled: !!todayList?.id,
    queryFn: async (): Promise<GroceryItem[]> => {
      const { data, error } = await supabase
        .from("grocery_items")
        .select("*")
        .eq("list_id", todayList!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Past item names for autocomplete suggestions
  const { data: pastNames = [] } = useQuery({
    queryKey: ["grocery-item-names"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("grocery_items")
        .select("name")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const seen = new Set<string>();
      const names: string[] = [];
      for (const row of data ?? []) {
        if (!seen.has(row.name)) {
          seen.add(row.name);
          names.push(row.name);
        }
      }
      return names.slice(0, 20);
    },
  });

  // Stock products for autocomplete (with price)
  const { data: stockSuggestions = [] } = useQuery({
    queryKey: ["stock-name-price"],
    queryFn: async (): Promise<{ name: string; price: number }[]> => {
      const { data, error } = await supabase
        .from("stock")
        .select("product_name, price")
        .order("product_name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        name: r.product_name,
        price: Number(r.price) || 0,
      }));
    },
  });

  type Suggestion = { name: string; source: "stock" | "history"; price?: number };
  const filteredSuggestions = useMemo<Suggestion[]>(() => {
    const q = itemName.trim().toLowerCase();
    const stockNames = new Set(stockSuggestions.map((s) => s.name.toLowerCase()));
    const stockList: Suggestion[] = stockSuggestions
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({ name: s.name, source: "stock", price: s.price }));
    const historyList: Suggestion[] = pastNames
      .filter((n) => !stockNames.has(n.toLowerCase()))
      .filter((n) => !q || n.toLowerCase().includes(q))
      .map((n) => ({ name: n, source: "history" }));
    return [...stockList, ...historyList].slice(0, 8);
  }, [itemName, pastNames, stockSuggestions]);

  const createList = useMutation({
    mutationFn: async () => {
      const budget = Number(budgetInput) || 0;
      const { data, error } = await supabase
        .from("grocery_lists")
        .insert({ date: todayISO(), budget })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("List started");
      queryClient.invalidateQueries({ queryKey: ["grocery-list", todayISO()] });
      setBudgetInput("");
      setBudgetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Could not start list"),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!todayList?.id) throw new Error("Start today's list first");
      const trimmed = itemName.trim();
      if (!trimmed) throw new Error("Item name is required");
      const qty = Number(itemQty) || 0;
      const unitPrice = Number(itemPrice) || 0;
      const { error } = await supabase.from("grocery_items").insert({
        list_id: todayList.id,
        name: trimmed,
        quantity: qty,
        unit: itemUnit,
        price: qty * unitPrice,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item added");
      queryClient.invalidateQueries({ queryKey: ["grocery-items", todayList?.id] });
      queryClient.invalidateQueries({ queryKey: ["grocery-item-names"] });
      setItemName("");
      setItemQty("1");
      setItemUnit("");
      setItemPrice("");
      setItemOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Could not add item"),
  });

  const setItemState = useMutation({
    mutationFn: async ({
      item,
      state,
    }: {
      item: GroceryItem;
      state: "bought" | "skipped" | "reset";
    }) => {
      const patch =
        state === "bought"
          ? { bought: true, skipped: false }
          : state === "skipped"
            ? { bought: false, skipped: true }
            : { bought: false, skipped: false };
      const { error } = await supabase.from("grocery_items").update(patch).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-items", todayList?.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update item"),
  });

  const toggleBought = useMutation({
    mutationFn: async (item: GroceryItem) => {
      const { error } = await supabase
        .from("grocery_items")
        .update({ bought: !item.bought })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-items", todayList?.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update item"),
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ item, delta }: { item: GroceryItem; delta: number }) => {
      const next = Math.max(0, Number(item.quantity) + delta);
      const { error } = await supabase
        .from("grocery_items")
        .update({ quantity: next })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-items", todayList?.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update quantity"),
  });

  const saveEdit = useMutation({
    mutationFn: async (item: GroceryItem) => {
      const trimmed = editName.trim();
      if (!trimmed) throw new Error("Item name is required");
      const qty = Number(editQty) || 0;
      const unitPrice = Number(editPrice) || 0;
      const { error } = await supabase
        .from("grocery_items")
        .update({
          name: trimmed,
          quantity: qty,
          unit: editUnit,
          price: qty * unitPrice,
        })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item updated");
      queryClient.invalidateQueries({ queryKey: ["grocery-items", todayList?.id] });
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message || "Could not update item"),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("grocery_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removed");
      queryClient.invalidateQueries({ queryKey: ["grocery-items", todayList?.id] });
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove item"),
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("grocery_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("List deleted");
      queryClient.invalidateQueries({ queryKey: ["grocery-lists-history"] });
      setExpandedHistoryId(null);
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete list"),
  });

  const finalizePurchase = useMutation({
    mutationFn: async () => {
      if (!todayList) throw new Error("No active list");
      const skippedItems = items.filter((i) => i.skipped);
      const toBuyItems = items.filter((i) => !i.skipped);

      if (toBuyItems.length > 0) {
        const { error: buyErr } = await supabase
          .from("grocery_items")
          .update({ bought: true })
          .in("id", toBuyItems.map((i) => i.id));
        if (buyErr) throw buyErr;
      }

      if (skippedItems.length > 0) {
        let tomorrow: GroceryList | null = null;
        const { data: existing, error: fetchErr } = await supabase
          .from("grocery_lists")
          .select("*")
          .eq("date", tomorrowISO())
          .eq("completed", false)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        tomorrow = existing;
        if (!tomorrow) {
          const { data: created, error: createErr } = await supabase
            .from("grocery_lists")
            .insert({ date: tomorrowISO(), budget: Number(todayList.budget) || 0 })
            .select()
            .single();
          if (createErr) throw createErr;
          tomorrow = created;
        }
        const rows = skippedItems.map((i) => ({
          list_id: tomorrow!.id,
          name: i.name,
          quantity: Number(i.quantity) || 0,
          unit: i.unit,
          price: Number(i.price) || 0,
          bought: false,
          skipped: false,
        }));
        const { error: insErr } = await supabase.from("grocery_items").insert(rows);
        if (insErr) throw insErr;
      }

      const { error: updErr } = await supabase
        .from("grocery_lists")
        .update({ completed: true })
        .eq("id", todayList.id);
      if (updErr) throw updErr;

      return skippedItems.length;
    },
    onSuccess: (movedCount) => {
      toast.success(
        movedCount > 0
          ? `Trip finalized · ${movedCount} item${movedCount === 1 ? "" : "s"} moved to tomorrow`
          : "Trip finalized",
      );
      const finishedListId = todayList?.id ?? null;
      queryClient.invalidateQueries({ queryKey: ["grocery-list", todayISO()] });
      queryClient.invalidateQueries({ queryKey: ["grocery-lists-history"] });
      setTab("history");
      setExpandedHistoryId(finishedListId);
    },
    onError: (e: Error) => toast.error(e.message || "Could not finalize"),
  });

  const spent = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.price), 0),
    [items],
  );
  const remaining = (Number(todayList?.budget) || 0) - spent;

  const skippedCount = items.filter((i) => i.skipped).length;
  const canFinalize = items.length > 0;
  const startEdit = (item: GroceryItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(String(item.quantity));
    setEditUnit(item.unit || "kg");
    const q = Number(item.quantity) || 0;
    const unitPrice = q > 0 ? Number(item.price) / q : Number(item.price);
    setEditPrice(unitPrice ? String(Number(unitPrice.toFixed(4))) : "");
  };

  const shareToWhatsApp = () => {
    if (!todayList) return;
    const dateLabel = new Date(todayList.date).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const lines = [
      `🛒 Grocery List — ${dateLabel}`,
      `Budget: ${formatCurrency(Number(todayList.budget))}`,
      "",
      ...items.map(
        (i, idx) =>
          `${idx + 1}. ${i.name} - ${i.quantity} ${i.unit || ""} - ${formatCurrency(Number(i.price))}${i.skipped ? " (skip)" : ""}`,
      ),
      "",
      `Spent: ${formatCurrency(spent)}`,
      `Remaining: ${formatCurrency(remaining)}`,
    ];
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <AppShell title="Grocery" subtitle="Daily shopping list" showFab={false}>
      {/* Summary card — shown on Skipped tab, and when no list exists yet */}
      {tab !== "history" && (tab === "skipped" || !todayList) && (
        <div className="solid-card mb-4 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Today's list
          </p>
          {todayList ? (
            <div className="mt-1 flex items-end justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Budget</p>
                <p
                  className={[
                    "mono-amount text-2xl",
                    remaining < 0 ? "text-destructive" : "text-secondary",
                  ].join(" ")}
                >
                  {formatCurrency(remaining)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Spent</p>
                <p className="mono-amount text-lg text-foreground">{formatCurrency(spent)}</p>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {listLoading ? "Loading…" : "No list started for today."}
              </p>
              <Button
                onClick={() => setBudgetOpen(true)}
                className="press h-10 rounded-xl gradient-warm text-sm font-semibold"
              >
                Set budget
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        {([
          ["todo", "To buy"],
          ["skipped", "Skipped"],
          ["history", "History"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "press pill flex-1 py-2 text-xs font-semibold",
              tab === t
                ? "gradient-warm text-primary-foreground"
                : "border border-border bg-card text-foreground",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TO BUY TAB — single collapsible section */}
      {tab === "todo" && todayList && (
        <>
          <div className="solid-card overflow-hidden">
            <button
              type="button"
              onClick={() => setTodoOpen((v) => !v)}
              className="press flex w-full items-center justify-between gap-3 p-4"
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">
                  {new Date(todayList.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <p
                  className={[
                    "text-xs",
                    remaining < 0 ? "text-destructive" : "text-muted-foreground",
                  ].join(" ")}
                >
                  Budget {formatCurrency(remaining)} · Spent{" "}
                  {formatCurrency(spent)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {items.length - skippedCount}/{items.length}
                </span>
                <ChevronDown
                  className={[
                    "h-4 w-4 text-muted-foreground transition-transform",
                    todoOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </div>
            </button>

            {todoOpen && (
              <div className="space-y-2 border-t border-border/60 p-3">
                {itemsLoading && (
                  <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
                )}
                {!itemsLoading && items.length === 0 && (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    No items yet. Tap + to add.
                  </p>
                )}
                {items.map((item) => {
                  const tint = item.skipped
                    ? "bg-red-50 border-red-200"
                    : "bg-card border-border";
                  return (
                    <div
                      key={item.id}
                      className={[
                        "flex items-center gap-2 rounded-2xl border p-3 transition-colors",
                        tint,
                      ].join(" ")}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(Number(item.price))}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 rounded-full border border-border bg-card px-1 py-1">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() =>
                            updateQuantity.mutate({ item, delta: -step(item.unit || "kg") })
                          }
                          className="press grid h-7 w-7 place-items-center rounded-full bg-muted/70"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="mono-amount min-w-[3rem] text-center text-xs">
                          {item.quantity}
                          <span className="ml-0.5 text-[10px] text-muted-foreground">
                            {item.unit || ""}
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() =>
                            updateQuantity.mutate({ item, delta: step(item.unit || "kg") })
                          }
                          className="press grid h-7 w-7 place-items-center rounded-full gradient-warm text-primary-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      
                      <button
                        type="button"
                        aria-label="Mark not bought"
                        onClick={() =>
                          setItemState.mutate({
                            item,
                            state: item.skipped ? "reset" : "skipped",
                          })
                        }
                        className={[
                          "press grid h-9 w-9 flex-none place-items-center rounded-full text-white",
                          item.skipped ? "bg-red-600" : "bg-red-500/80",
                        ].join(" ")}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="mt-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => finalizePurchase.mutate()}
                  disabled={finalizePurchase.isPending}
                  className="press h-12 flex-1 rounded-2xl gradient-warm text-base font-semibold"
                >
                  <Flag className="mr-2 h-4 w-4" />
                  {finalizePurchase.isPending ? "Finalizing…" : "Final Purchase"}
                </Button>
                <button
                  type="button"
                  aria-label="Share list on WhatsApp"
                  onClick={shareToWhatsApp}
                  className="press grid h-12 w-12 flex-none place-items-center rounded-2xl bg-[#25D366] text-white"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
              {skippedCount > 0 && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  {skippedCount} skipped item{skippedCount === 1 ? "" : "s"} will move to tomorrow's list.
                </p>
              )}
            </div>
          )}
        </>
      )}


      {/* SKIPPED TAB — editable */}
      {tab === "skipped" && todayList && (
        <div className="space-y-2">
          {items.filter(it => it.skipped).length === 0 &&(
            <div className="solid-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No items yet.</p>
            </div>
          )}
          {items.filter(it => it.skipped).map((item) => (
            <div key={item.id} className="solid-card p-4">
              
              {editingId === item.id ? (
                <div className="space-y-3">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-10"
                    placeholder="Item name"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1 rounded-xl border border-input px-1 py-1">
                      <button
                        type="button"
                        onClick={() =>
                          setEditQty((q) => String(Math.max(0, Number(q || 0) - step(editUnit))))
                        }
                        className="press grid h-8 w-8 flex-none place-items-center rounded-lg bg-muted/70"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <Input
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        inputMode="decimal"
                        className="h-8 border-0 text-center shadow-none"
                      />
                      <button
                        type="button"
                        onClick={() => setEditQty((q) => String(Number(q || 0) + step(editUnit)))}
                        className="press grid h-8 w-8 flex-none place-items-center rounded-lg gradient-warm text-primary-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Select value={editUnit} onValueChange={setEditUnit}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price per unit</Label>
                    <Input
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      inputMode="decimal"
                      className="h-10"
                      placeholder="Price per unit"
                    />
                    <p className="text-xs text-muted-foreground">
                      Total: {formatCurrency((Number(editQty) || 0) * (Number(editPrice) || 0))}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit.mutate(item)}
                      className="press flex h-9 flex-1 items-center justify-center gap-1 rounded-xl gradient-warm text-sm font-semibold text-primary-foreground"
                    >
                      <Check className="h-4 w-4" /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="press grid h-9 w-9 place-items-center rounded-xl bg-muted/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => deleteItem.mutate(item.id)}
                        className="press grid h-9 w-9 place-items-center rounded-xl bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} {item.unit || ""} · {formatCurrency(Number(item.price))}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Restore to To Buy"
                    onClick={() => setItemState.mutate({ item, state: "reset" })}
                    className="press flex h-9 items-center gap-1 rounded-full bg-secondary px-3 text-xs font-semibold text-secondary-foreground"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    aria-label="Edit item"
                    onClick={() => startEdit(item)}
                    className="press grid h-8 w-8 flex-none place-items-center rounded-full bg-muted/70"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab !== "history" && !todayList && !listLoading && (
        <div className="solid-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Set a budget to start today's list.</p>
        </div>
      )}

      {tab !== "history" && todayList && (
        <button
          type="button"
          onClick={() => setItemOpen(true)}
          aria-label="Add item"
          className="press fixed right-5 bottom-24 z-40 grid h-14 w-14 place-items-center rounded-full gradient-warm shadow-[var(--shadow-pop)]"
        >
          <Plus className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
        </button>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div className="space-y-2">
          {pastLists.length === 0 && (
            <div className="solid-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No past lists yet.</p>
            </div>
          )}
          {pastLists.map((l) => (
            <div key={l.id} className="solid-card overflow-hidden">
              <button 
                type="button"
                onClick={() => setExpandedHistoryId(expandedHistoryId === l.id ? null : l.id)}
                className="press flex w-full items-center justify-between p-4"
              >
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{l.date}</p>
                    {l.completed && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Budget {formatCurrency(Number(l.budget))}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Delete list"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteList.mutate(l.id);
                      }}
                      className="press grid h-8 w-8 place-items-center rounded-full bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </span>
                  )}
                  <ChevronDown
                    className={[
                      "h-4 w-4 text-muted-foreground transition-transform",
                      expandedHistoryId === l.id ? "rotate-180" : "",
                    ].join(" ")}
                  />
                </div>
              </button>
              {expandedHistoryId === l.id && (() => {
                const purchased = historyItems.filter((it) => !it.skipped);
                const skipped = historyItems.filter((it) => it.skipped);
                const total = purchased.reduce(
                  (s, it) => s + Number(it.price),
                  0,
                );
                return (
                  <div className="space-y-4 border-t border-border/60 p-4 pt-3">
                    {/* Purchased */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Purchased
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {purchased.length} item{purchased.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {purchased.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No items were purchased on this trip.
                        </p>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            {purchased.map((it) => (
                              <div
                                key={it.id}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-foreground">
                                  {it.name} · {it.quantity} {it.unit}
                                </span>
                                <span className="mono-amount text-secondary">
                                  {formatCurrency(Number(it.price))}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Total spent
                            </span>
                            <span className="mono-amount text-base font-semibold text-secondary">
                              {formatCurrency(total)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Skipped */}
                    <div className="space-y-2 border-t border-border/60 pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                          Skipped items
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {skipped.length} item{skipped.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {skipped.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No items were skipped on this trip.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {skipped.map((it) => (
                            <div
                              key={it.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-foreground">
                                {it.name} · {it.quantity} {it.unit}
                              </span>
                              <span className="mono-amount text-muted-foreground">
                                {formatCurrency(Number(it.price))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Set budget dialog */}
      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">Start today's list</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="g-budget">Budget</Label>
            <Input
              id="g-budget"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              inputMode="decimal"
              placeholder="3000"
              className="h-12"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => createList.mutate()}
              disabled={createList.isPending}
              className="press h-12 w-full rounded-2xl gradient-warm text-base font-semibold"
            >
              {createList.isPending ? "Starting…" : "Start list"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add item dialog */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">Add item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative space-y-2">
              <Label htmlFor="g-name">Item name</Label>
              <Input
                id="g-name"
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="e.g. Coffee powder"
                className="h-12"
                autoComplete="off"
                autoFocus
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="glass absolute inset-x-0 top-full z-50 mt-1 max-h-48 overflow-y-auto p-1.5">
                  {filteredSuggestions.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setItemName(n);
                        setShowSuggestions(false);
                      }}
                      className="press block w-full rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted/70"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="g-qty">Quantity</Label>
                <div className="flex items-center gap-1.5 rounded-xl border border-input px-1.5 py-1.5">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() =>
                      setItemQty((q) => String(Math.max(0, Number(q || 0) - step(itemUnit))))
                    }
                    className="press grid h-9 w-9 flex-none place-items-center rounded-lg bg-muted/70"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <Input
                    id="g-qty"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    inputMode="decimal"
                    className="h-9 border-0 text-center shadow-none"
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() =>
                      setItemQty((q) => String(Number(q || 0) + step(itemUnit)))
                    }
                    className="press grid h-9 w-9 flex-none place-items-center rounded-lg gradient-warm text-primary-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={itemUnit} onValueChange={setItemUnit}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-price">Price per unit</Label>
              <Input
                id="g-price"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="h-12"
              />
              <div className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="mono-amount font-semibold text-secondary">
                  {formatCurrency((Number(itemQty) || 0) * (Number(itemPrice) || 0))}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addItem.mutate()}
              disabled={addItem.isPending || !itemName.trim()}
              className="press h-12 w-full rounded-2xl gradient-warm text-base font-semibold"
            >
              {addItem.isPending ? "Adding…" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

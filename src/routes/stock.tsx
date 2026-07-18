import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Package, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/stock")({
  component: StockPage,
  head: () => ({ meta: [{ title: "Stock — Divakar Tea Shop" }] }),
});

type Stock = Tables<"stock">;

const UNITS = ["kg", "g", "litre", "ml", "piece", "packet", "box", "dozen"];

function StockPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["stock"],
    queryFn: async (): Promise<Stock[]> => {
      const { data, error } = await supabase
        .from("stock")
        .select("*")
        .order("product_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetForm = () => {
    setProductName("");
    setQuantity("");
    setUnit("kg");
    setPrice("");
    setImageUrl("");
  };

  const addProduct = useMutation({
    mutationFn: async () => {
      const trimmed = productName.trim();
      if (!trimmed) throw new Error("Product name is required");
      const qty = Number(quantity) || 0;
      const prc = Number(price) || 0;
      const { error } = await supabase.from("stock").insert({
        product_name: trimmed,
        quantity: qty,
        unit,
        price: prc,
        image_url: imageUrl.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product added");
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      resetForm();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Could not add product"),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product removed");
      queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove product"),
  });

  const totalValue = products.reduce(
    (sum, p) => sum + Number(p.quantity) * Number(p.price),
    0,
  );

  return (
    <AppShell title="Stock" subtitle="Products and inventory" showFab={false}>
      <div className="solid-card mb-4 flex items-center justify-between p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total stock value
          </p>
          <p className="mono-amount mt-1 text-2xl text-secondary">
            {formatCurrency(totalValue)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Products
          </p>
          <p className="mono-amount mt-1 text-2xl text-secondary">{products.length}</p>
        </div>
      </div>

      {isLoading && (
        <div className="glass p-6 text-center text-sm text-muted-foreground">
          Loading stock…
        </div>
      )}
      {error && (
        <div className="glass p-6 text-center text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      {!isLoading && products.length === 0 && (
        <div className="glass p-8 text-center">
          <p className="text-sm text-muted-foreground">No products yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap the + button to add your first product.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <div key={p.id} className="glass press relative p-4">
            {isAdmin && (
              <button
                type="button"
                aria-label="Delete product"
                onClick={() => deleteProduct.mutate(p.id)}
                className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-card/80"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            )}
            <div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-muted/60">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.product_name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <Package className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <p className="mt-3 truncate text-sm font-semibold">{p.product_name}</p>
            <p className="text-xs text-muted-foreground">
              {p.quantity} {p.unit || ""}
            </p>
            <p className="mono-amount mt-1 text-lg text-secondary">
              {formatCurrency(Number(p.quantity) * Number(p.price))}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add product"
        className="press fixed right-5 bottom-24 z-40 grid h-14 w-14 place-items-center rounded-full gradient-warm shadow-[var(--shadow-pop)]"
      >
        <Plus className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">Add product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="p-name">Product name</Label>
              <Input
                id="p-name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Tea powder"
                className="h-12"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-qty">Quantity</Label>
                <Input
                  id="p-qty"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
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
              <Label htmlFor="p-price">Price</Label>
              <Input
                id="p-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-img">Image URL (optional)</Label>
              <Input
                id="p-img"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                className="h-12"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addProduct.mutate()}
              disabled={addProduct.isPending || !productName.trim()}
              className="press h-12 w-full rounded-2xl gradient-warm text-base font-semibold"
            >
              {addProduct.isPending ? "Adding…" : "Add product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

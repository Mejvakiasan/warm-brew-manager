import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Package, Trash2, Pencil } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/stock")({
  component: StockPage,
  head: () => ({ meta: [{ title: "Stock — Divakar Tea Shop" }] }),
});

type Stock = Tables<"stock">;

function StockPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Stock | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Stock | null>(null);

  const [productName, setProductName] = useState("");
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
    setPrice("");
    setImageUrl("");
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (p: Stock) => {
    setEditing(p);
    setProductName(p.product_name);
    setPrice(String(p.price ?? ""));
    setImageUrl(p.image_url ?? "");
    setOpen(true);
  };

  const saveProduct = useMutation({
    mutationFn: async () => {
      const trimmed = productName.trim();
      if (!trimmed) throw new Error("Product name is required");
      const prc = Number(price) || 0;
      const payload = {
        product_name: trimmed,
        price: prc,
        image_url: imageUrl.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("stock").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("stock")
          .insert({ ...payload, quantity: 0, unit: "" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product added");
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      resetForm();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Could not save product"),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product removed");
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove product"),
  });

  return (
    <AppShell title="Stock" subtitle="Product catalog" showFab={false}>
      <div className="solid-card mb-4 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Total products
        </p>
        <p className="mono-amount mt-1 text-2xl text-secondary">{products.length}</p>
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
              <div className="absolute right-2 top-2 z-10 flex gap-1">
                <button
                  type="button"
                  aria-label="Edit product"
                  onClick={() => openEdit(p)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-card/80"
                >
                  <Pencil className="h-3.5 w-3.5 text-secondary" />
                </button>
                <button
                  type="button"
                  aria-label="Delete product"
                  onClick={() => setConfirmDelete(p)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-card/80"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
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
            <p className="mono-amount mt-1 text-lg text-secondary">
              {formatCurrency(Number(p.price))}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={openAdd}
        aria-label="Add product"
        className="press fixed right-5 bottom-24 z-40 grid h-14 w-14 place-items-center rounded-full gradient-warm shadow-[var(--shadow-pop)]"
      >
        <Plus className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
      </button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit product" : "Add product"}
            </DialogTitle>
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
              onClick={() => saveProduct.mutate()}
              disabled={saveProduct.isPending || !productName.trim()}
              className="press h-12 w-full rounded-2xl gradient-warm text-base font-semibold"
            >
              {saveProduct.isPending
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Add product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.product_name}?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteProduct.mutate(confirmDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

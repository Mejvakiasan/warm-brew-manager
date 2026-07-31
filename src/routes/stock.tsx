import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Package, Trash2, Pencil, Search, X, ChevronDown, FolderPlus } from "lucide-react";
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
type Category = Tables<"categories">;

const UNCATEGORIZED = "__uncategorized__";

function StockPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Stock | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Stock | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState<string>(UNCATEGORIZED);
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

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

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetForm = () => {
    setProductName("");
    setPrice("");
    setImageUrl("");
    setCategoryId(UNCATEGORIZED);
    setNewCategoryMode(false);
    setNewCategoryName("");
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
    setCategoryId(p.category_id ?? UNCATEGORIZED);
    setNewCategoryMode(false);
    setNewCategoryName("");
    setOpen(true);
  };

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveProduct = useMutation({
    mutationFn: async () => {
      const trimmed = productName.trim();
      if (!trimmed) throw new Error("Product name is required");
      const prc = Number(price) || 0;

      let resolvedCategoryId: string | null =
        categoryId === UNCATEGORIZED ? null : categoryId;

      if (newCategoryMode) {
        const name = newCategoryName.trim();
        if (!name) throw new Error("Enter a category name");
        const newCat = await createCategory.mutateAsync(name);
        resolvedCategoryId = newCat?.id ?? null;
      }

      const payload = {
        product_name: trimmed,
        price: prc,
        image_url: imageUrl.trim() || null,
        category_id: resolvedCategoryId,
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
      queryClient.invalidateQueries({ queryKey: ["categories"] });
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

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category deleted — its products are now uncategorized");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setConfirmDeleteCategory(null);
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete category"),
  });

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.product_name.toLowerCase().includes(q));
  }, [products, search]);

  const groups = useMemo(() => {
    const byId = new Map<string, Stock[]>();
    for (const p of filteredProducts) {
      const key = p.category_id ?? UNCATEGORIZED;
      if (!byId.has(key)) byId.set(key, []);
      byId.get(key)!.push(p);
    }
    const named = categories
      .filter((c) => byId.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, products: byId.get(c.id)! }));
    const uncategorized = byId.get(UNCATEGORIZED);
    return uncategorized
      ? [...named, { id: UNCATEGORIZED, name: "Uncategorized", products: uncategorized }]
      : named;
  }, [filteredProducts, categories]);

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <AppShell title="Stock" subtitle="Product catalog" showFab={false}>
      <div className="solid-card mb-4 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Total products
        </p>
        <p className="mono-amount mt-1 text-2xl text-secondary">{products.length}</p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
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

      {!isLoading && products.length > 0 && filteredProducts.length === 0 && (
        <div className="glass p-8 text-center">
          <p className="text-sm text-muted-foreground">No products match "{search}".</p>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.id);
          return (
            <div key={group.id}>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(group.id)}
                  className="press flex items-center gap-1.5"
                >
                  <ChevronDown
                    className={[
                      "h-4 w-4 text-muted-foreground transition-transform",
                      isCollapsed ? "-rotate-90" : "",
                    ].join(" ")}
                  />
                  <span className="font-display text-sm font-bold text-secondary">
                    {group.name}
                  </span>
                  <span className="text-xs text-muted-foreground">({group.products.length})</span>
                </button>
                {isAdmin && group.id !== UNCATEGORIZED && (
                  <button
                    type="button"
                    aria-label={`Delete category ${group.name}`}
                    onClick={() =>
                      setConfirmDeleteCategory(categories.find((c) => c.id === group.id) ?? null)
                    }
                    className="press grid h-7 w-7 place-items-center rounded-full bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                )}
              </div>

              {!isCollapsed && (
                <div className="grid grid-cols-4 gap-3">
                  {group.products.map((p) => (
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
              )}
            </div>
          );
        })}
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
                placeholder="e.g. Good Day"
                className="h-12"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              {!newCategoryMode ? (
                <div className="flex gap-2">
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-12 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNCATEGORIZED}>Uncategorized</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    aria-label="Add new category"
                    onClick={() => setNewCategoryMode(true)}
                    className="press grid h-12 w-12 flex-none place-items-center rounded-xl bg-secondary/15"
                  >
                    <FolderPlus className="h-5 w-5 text-secondary" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Biscuit"
                    className="h-12 flex-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryMode(false);
                      setNewCategoryName("");
                    }}
                    className="press grid h-12 w-12 flex-none place-items-center rounded-xl bg-muted/70"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
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
              disabled={
                saveProduct.isPending ||
                !productName.trim() ||
                (newCategoryMode && !newCategoryName.trim())
              }
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

      <AlertDialog
        open={!!confirmDeleteCategory}
        onOpenChange={(v) => !v && setConfirmDeleteCategory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category "{confirmDeleteCategory?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Products in this category will NOT be deleted — they'll just move to
              "Uncategorized".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmDeleteCategory && deleteCategory.mutate(confirmDeleteCategory.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { listUsersForAdmin, promoteUserToAdmin } from "@/lib/auth.functions";
import { ShieldCheck, LogOut } from "lucide-react";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ta", label: "தமிழ் (Tamil)" },
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "te", label: "తెలుగు (Telugu)" },
  { value: "kn", label: "ಕನ್ನಡ (Kannada)" },
];

const appSettingsQuery = queryOptions({
  queryKey: ["app_settings"],
  queryFn: async (): Promise<Tables<"app_settings"> | null> => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("id, shop_name, default_language, created_at, setup_key")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Divakar Tea Shop" }] }),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Failed to load settings: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Settings not found.</div>,
});

function SettingsPage() {
  const { data: settings } = useSuspenseQuery(appSettingsQuery);
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();

  const [shopName, setShopName] = useState(settings?.shop_name ?? "");
  const [language, setLanguage] = useState(settings?.default_language ?? "en");

  useEffect(() => {
    if (settings) {
      setShopName(settings.shop_name);
      setLanguage(settings.default_language);
    }
  }, [settings?.id]);

  const mutation = useMutation({
    mutationFn: async (patch: TablesUpdate<"app_settings">) => {
      if (!settings) throw new Error("Settings not initialised yet.");
      const { data, error } = await supabase
        .from("app_settings")
        .update(patch)
        .eq("id", settings.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("You don't have permission to update settings. Admin only.");
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(appSettingsQuery.queryKey, data);
      toast.success("Settings saved");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save settings"),
  });

  const dirty =
    shopName.trim() !== (settings?.shop_name ?? "") ||
    language !== (settings?.default_language ?? "en");

  const onSave = () => {
    const name = shopName.trim();
    if (!name) return toast.error("Shop name can't be empty");
    mutation.mutate({ shop_name: name, default_language: language });
  };

  const onSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
  };

  return (
    <AppShell title="Settings" subtitle="Shop preferences" showFab={false}>
      <div className="solid-card space-y-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed in as</p>
            <p className="text-sm font-semibold">{user?.email}</p>
          </div>
          {isAdmin && (
            <span className="pill inline-flex items-center gap-1 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </span>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="shop-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Shop name
          </Label>
          <Input
            id="shop-name"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Divakar Tea Shop"
            className="h-12 text-base"
            disabled={!isAdmin}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Default language
          </Label>
          <Select value={language} onValueChange={setLanguage} disabled={!isAdmin}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={onSave}
          disabled={!dirty || mutation.isPending || !isAdmin}
          className="press h-12 w-full rounded-2xl gradient-warm text-base font-semibold shadow-[var(--shadow-pop)]"
        >
          {mutation.isPending ? "Saving…" : isAdmin ? "Save changes" : "Admins only"}
        </Button>
      </div>

      {isAdmin && <ManageUsers />}

      <Button
        variant="outline"
        onClick={onSignOut}
        className="press mt-6 h-12 w-full rounded-2xl border-border"
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>

      <p className="mt-4 px-2 text-xs text-muted-foreground">
        Changes apply to every device using this shop's account.
      </p>
    </AppShell>
  );
}

function ManageUsers() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listUsersForAdmin);
  const promoteFn = useServerFn(promoteUserToAdmin);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const promote = useMutation({
    mutationFn: (userId: string) => promoteFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("User promoted to admin");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not promote user"),
  });

  return (
    <section className="mt-6">
      <h2 className="mb-3 font-display text-lg font-bold text-secondary">Manage users</h2>
      <div className="solid-card divide-y divide-border p-0">
        {isLoading && <p className="p-5 text-sm text-muted-foreground">Loading users…</p>}
        {error && <p className="p-5 text-sm text-destructive">{(error as Error).message}</p>}
        {users?.length === 0 && (
          <p className="p-5 text-sm text-muted-foreground">No other users yet.</p>
        )}
        {users?.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{u.name || u.email}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            </div>
            {u.isAdmin ? (
              <span className="pill inline-flex items-center gap-1 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </span>
            ) : (
              <Button
                size="sm"
                onClick={() => promote.mutate(u.id)}
                disabled={promote.isPending}
                className="press rounded-full gradient-warm text-xs font-semibold"
              >
                Make admin
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

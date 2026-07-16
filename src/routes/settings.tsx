import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(appSettingsQuery),
  head: () => ({ meta: [{ title: "Settings — Divakar Tea Shop" }] }),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Failed to load settings: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Settings not found.</div>,
});

function SettingsPage() {
  const { data: settings } = useSuspenseQuery(appSettingsQuery);
  const queryClient = useQueryClient();

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
        .single();
      if (error) throw error;
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
    if (!name) {
      toast.error("Shop name can't be empty");
      return;
    }
    mutation.mutate({ shop_name: name, default_language: language });
  };

  return (
    <AppShell title="Settings" subtitle="Shop preferences" showFab={false}>
      <div className="solid-card space-y-6 p-5">
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
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Default language
          </Label>
          <Select value={language} onValueChange={setLanguage}>
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
          disabled={!dirty || mutation.isPending}
          className="press h-12 w-full rounded-2xl gradient-warm text-base font-semibold shadow-[var(--shadow-pop)]"
        >
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <p className="mt-4 px-2 text-xs text-muted-foreground">
        Changes apply to every device using this shop's account.
      </p>
    </AppShell>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const bootstrapSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  setupKey: z.string().min(1),
});

const promoteSchema = z.object({ userId: z.string().uuid() });

export const getBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return { needsBootstrap: (count ?? 0) === 0 };
});

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bootstrapSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. No existing admin
    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) throw new Error("An admin already exists.");

    // 2. Setup key matches
    const { data: settings, error: sErr } = await supabaseAdmin
      .from("app_settings")
      .select("id, setup_key")
      .limit(1)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!settings?.setup_key || settings.setup_key !== data.setupKey) {
      throw new Error("Invalid setup key.");
    }

    // 3. Create user (auto-confirmed since setup key already proves authorization)
    const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (uErr || !created.user) throw new Error(uErr?.message || "Could not create user.");
    const userId = created.user.id;

    // 4. Insert into public.users and grant admin role
    const { error: pErr } = await supabaseAdmin
      .from("users")
      .insert({ id: userId, email: data.email, name: data.name, email_verified: true, role: "admin" });
    if (pErr) throw new Error(pErr.message);

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (rErr) throw new Error(rErr.message);

    return { ok: true };
  });

export const promoteUserToAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => promoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Verify caller is admin (RLS-scoped user client)
    const { data: isAdmin, error: hrErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (hrErr) throw new Error(hrErr.message);
    if (!isAdmin) throw new Error("Only admins can promote users.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: "admin" });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);

    // Mirror on public.users.role for legacy compatibility
    await supabaseAdmin.from("users").update({ role: "admin" }).eq("id", data.userId);

    return { ok: true };
  });

export const listUsersForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can view users.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const adminSet = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

    return (users ?? []).map((u) => ({ ...u, isAdmin: adminSet.has(u.id) }));
  });

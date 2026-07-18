import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAdmin, getBootstrapStatus } from "@/lib/auth.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Divakar Tea Shop" }] }),
});

type Mode = "signin" | "signup" | "bootstrap";

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const bootstrapFn = useServerFn(bootstrapAdmin);
  const bootstrapStatusFn = useServerFn(getBootstrapStatus);

  const { data: bootstrapStatus } = useQuery({
    queryKey: ["bootstrap-status"],
    queryFn: () => bootstrapStatusFn(),
    staleTime: 30_000,
  });

  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);

  // shared fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");

  // Redirect signed-in users away
  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  // Default to bootstrap mode when needed
  useEffect(() => {
    if (bootstrapStatus?.needsBootstrap) setMode("bootstrap");
  }, [bootstrapStatus?.needsBootstrap]);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw error;
      toast.success("Check your email for the 6-digit code");
      setMode("verify");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from("users").upsert({
          id: data.user.id,
          email,
          name,
          email_verified: true,
          role: "staff",
        });
      }
      // If a session came back immediately, we're already signed in.
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      toast.success("Account created. Welcome!");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  const handleBootstrap = async () => {
    setBusy(true);
    try {
      await bootstrapFn({ data: { name, email, password, setupKey } });
      toast.success("Admin account created. Signing you in…");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create admin");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen px-5 py-10">
      <div className="mx-auto max-w-md">
        <header className="mb-8 text-center">
          <h1 className="font-display text-3xl font-extrabold text-secondary">Divakar Tea Shop</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "bootstrap"
              ? "Create your admin account to get started"
              : mode === "signup"
              ? "Create a new account"
              : "Sign in to continue"}
          </p>
        </header>

        <div className="solid-card space-y-4 p-5">
          {(mode === "signup" || mode === "bootstrap") && (
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
            </Field>
          )}

          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
            />
          </Field>

          {mode === "bootstrap" && (
            <Field label="Setup key">
              <Input
                value={setupKey}
                onChange={(e) => setSetupKey(e.target.value)}
                placeholder="Provided by shop owner"
                className="h-12"
              />
            </Field>
          )}

          <Button
            className="press h-12 w-full rounded-2xl gradient-warm text-base font-semibold"
            disabled={busy}
            onClick={
              mode === "signin"
                ? handleSignIn
                : mode === "signup"
                ? handleSignUp
                : handleBootstrap
            }
          >
            {busy
              ? "Please wait…"
              : mode === "signin"
              ? "Sign in"
              : mode === "signup"
              ? "Create account"
              : "Create admin account"}
          </Button>
        </div>

        {mode !== "bootstrap" && !bootstrapStatus?.needsBootstrap && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            {mode === "signin" ? (
              <button
                type="button"
                className="text-primary underline underline-offset-4"
                onClick={() => setMode("signup")}
              >
                New here? Create an account
              </button>
            ) : (
              <button
                type="button"
                className="text-primary underline underline-offset-4"
                onClick={() => setMode("signin")}
              >
                Already have an account? Sign in
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

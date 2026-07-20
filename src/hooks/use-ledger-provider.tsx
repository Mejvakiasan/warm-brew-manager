import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SupabaseLedgerProvider, LocalLedgerProvider } from "@/integrations/ledger-provider";

/**
 * Hook to get the appropriate ledger provider
 * @param useLocal - If true, returns LocalLedgerProvider for testing. Defaults to false (uses Supabase).
 */
export function useLedgerProvider(useLocal: boolean = false) {
  const provider = useMemo(() => {
    if (useLocal) {
      return new LocalLedgerProvider();
    }
    return new SupabaseLedgerProvider(supabase);
  }, [useLocal]);

  return provider;
}

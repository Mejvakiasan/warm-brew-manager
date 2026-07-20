import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { CustomerLedger, LocalLedgerProvider } from "@/components/customer-ledger";

export const Route = createFileRoute("/ledger")({
  component: LedgerPage,
  head: () => ({ meta: [{ title: "Ledger — Divakar Tea Shop" }] }),
});

function LedgerPage() {
  // Use local provider for testing/development
  const provider = useMemo(() => new LocalLedgerProvider(), []);
  const testCustomerId = "test-customer-123";

  return (
    <AppShell title="Ledger" subtitle="Track purchases by date" showFab={false}>
      <CustomerLedger
        provider={provider}
        customerId={testCustomerId}
        onEntriesChange={(entries) => {
          console.log("Entries updated:", entries);
        }}
      />
    </AppShell>
  );
}

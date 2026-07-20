import { useState, useEffect } from "react";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import type { Entry, LedgerProvider } from "@/integrations/ledger-provider";

interface CustomerLedgerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  provider: LedgerProvider;
  onBalanceChange?: () => void;
}

export function CustomerLedgerModal({
  open,
  onOpenChange,
  customerId,
  customerName,
  provider,
  onBalanceChange,
}: CustomerLedgerModalProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [amount, setAmount] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(false);

  // Load entries when modal opens
  useEffect(() => {
    if (!open) return;

    const loadEntries = async () => {
      try {
        setIsLoading(true);
        const loadedEntries = await provider.getEntries(customerId);
        setEntries(loadedEntries);
      } catch (error) {
        toast.error("Failed to load entries");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntries();
  }, [open, customerId, provider]);

  // Group entries by date
  const entriesByDate = entries.reduce(
    (acc, entry) => {
      if (!acc[entry.date]) {
        acc[entry.date] = [];
      }
      acc[entry.date].push(entry);
      return acc;
    },
    {} as Record<string, Entry[]>
  );

  const totalAmount = entries.reduce((sum, e) => sum + Number(e.amount), 0);

  const handleAddEntry = async () => {
    const parsedAmount = parseFloat(amount);
    if (!amount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      const newEntry = await provider.addEntry(customerId, selectedDate, parsedAmount);
      const updatedEntries = [...entries, newEntry];
      setEntries(updatedEntries);
      setAmount("");
      toast.success("Entry added");
      onBalanceChange?.();
    } catch (error: any) {
      const errorMessage = error?.message || error?.error_description || "Failed to add entry";
      toast.error(errorMessage);
      console.error("Add entry error:", error);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await provider.deleteEntry(id);
      const updatedEntries = entries.filter((e) => e.id !== id);
      setEntries(updatedEntries);
      toast.success("Entry deleted");
      onBalanceChange?.();
    } catch (error: any) {
      const errorMessage = error?.message || error?.error_description || "Failed to delete entry";
      toast.error(errorMessage);
      console.error("Delete entry error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">{customerName} — Entries</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Entry Form */}
          <div className="space-y-3 border-b pb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entry-date" className="text-xs">
                  Date
                </Label>
                <input
                  id="entry-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-amount" className="text-xs">
                  Amount (₹)
                </Label>
                <Input
                  id="entry-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="h-10"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddEntry();
                    }
                  }}
                />
              </div>
            </div>
            <Button
              onClick={handleAddEntry}
              disabled={isLoading || !amount.trim()}
              className="press h-10 w-full rounded-lg gradient-warm text-sm font-semibold text-primary-foreground"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isLoading ? "Adding…" : "Add Entry"}
            </Button>
          </div>

          {/* Entries List */}
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading entries…
            </div>
          ) : entries.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No entries yet. Add one above to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(entriesByDate)
                .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                .map(([date, dateEntries]) => {
                  const dateTotal = dateEntries.reduce(
                    (sum, e) => sum + Number(e.amount),
                    0
                  );
                  const dateObj = new Date(date);
                  const formattedDate = dateObj.toLocaleDateString("en-IN", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <div key={date} className="space-y-2 rounded-lg border border-muted bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">
                          {formattedDate}
                        </p>
                        <p className="mono-amount text-sm font-bold text-secondary">
                          {formatCurrency(dateTotal)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        {dateEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between rounded bg-background px-2 py-1.5"
                          >
                            <span className="text-sm font-semibold text-foreground">
                              ₹{Number(entry.amount).toFixed(2)}
                            </span>
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              disabled={isLoading}
                              className="press rounded p-1 hover:bg-destructive/10"
                              aria-label="Delete entry"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Total */}
          {entries.length > 0 && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between rounded-lg bg-linear-to-br from-secondary/5 to-secondary/10 p-3">
                <p className="text-sm font-semibold text-muted-foreground">Total</p>
                <p className="mono-amount text-lg font-bold text-secondary">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

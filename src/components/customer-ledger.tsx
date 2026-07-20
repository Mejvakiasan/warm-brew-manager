import { useState, useEffect } from "react";
import Calendar from "react-calendar";
import { Trash2 } from "lucide-react";
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
import type { LedgerProvider, Entry } from "@/integrations/ledger-provider";
import "react-calendar/dist/Calendar.css";

export type { Entry, LedgerProvider } from "@/integrations/ledger-provider";
export { LocalLedgerProvider, SupabaseLedgerProvider } from "@/integrations/ledger-provider";

interface CustomerLedgerProps {
  provider: LedgerProvider;
  customerId: string;
  onEntriesChange?: (entries: Entry[]) => void;
}

export function CustomerLedger({ provider, customerId, onEntriesChange }: CustomerLedgerProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load entries from provider on mount and when customerId changes
  useEffect(() => {
    const loadEntries = async () => {
      try {
        setIsLoading(true);
        const loadedEntries = await provider.getEntries(customerId);
        setEntries(loadedEntries);
        onEntriesChange?.(loadedEntries);
      } catch (error) {
        toast.error("Failed to load entries");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntries();
  }, [customerId, provider, onEntriesChange]);

  const formatDateToISO = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  const selectedDateISO = formatDateToISO(selectedDate);
  const entriesForDate = entries.filter((e) => e.date === selectedDateISO);

  const dailyTotal = entriesForDate.reduce((sum, e) => sum + e.amount, 0);
  const overallTotal = entries.reduce((sum, e) => sum + e.amount, 0);

  const handleAddEntry = async () => {
    const parsedAmount = parseFloat(amount);
    if (!amount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      const newEntry = await provider.addEntry(customerId, selectedDateISO, parsedAmount);
      const updatedEntries = [...entries, newEntry];
      setEntries(updatedEntries);
      onEntriesChange?.(updatedEntries);
      setAmount("");
      toast.success(`Added ₹${parsedAmount.toFixed(2)}`);
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
      onEntriesChange?.(updatedEntries);
      toast.success("Entry deleted");
    } catch (error: any) {
      const errorMessage = error?.message || error?.error_description || "Failed to delete entry";
      toast.error(errorMessage);
      console.error("Delete entry error:", error);
    }
  };

  const handleDateClick = (value: any) => {
    if (value instanceof Date) {
      setSelectedDate(value);
      setIsDialogOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Calendar Section */}
      <div className="solid-card overflow-hidden p-4">
        <style>{`
          .react-calendar {
            width: 100%;
            border: none;
            background: transparent;
            font-family: inherit;
          }
          .react-calendar__navigation {
            margin-bottom: 1rem;
          }
          .react-calendar__navigation button {
            font-size: 0.9rem;
            padding: 0.5rem;
          }
          .react-calendar__month-view__weekdays {
            text-transform: uppercase;
            font-size: 0.75rem;
            font-weight: 600;
            letter-spacing: 0.05em;
            padding-bottom: 0.5rem;
            color: hsl(var(--muted-foreground));
          }
          .react-calendar__month-view__weekdays__weekday {
            padding: 0.25rem;
          }
          .react-calendar__month-view__days__day {
            padding: 0.5rem 0;
            font-size: 0.875rem;
          }
          .react-calendar__tile {
            padding: 0.75rem 0.5rem;
            border-radius: 0.375rem;
            transition: all 0.2s;
          }
          .react-calendar__tile:hover:enabled {
            background-color: hsl(var(--muted));
          }
          .react-calendar__tile--now {
            background-color: hsl(var(--secondary) / 0.2);
            font-weight: 600;
          }
          .react-calendar__tile--active {
            background: linear-gradient(135deg, var(--gradient-warm-from), var(--gradient-warm-to));
            color: white;
            font-weight: 600;
          }
          .react-calendar__tile--active:hover {
            opacity: 0.9;
          }
        `}</style>
        <Calendar
          value={selectedDate}
          onChange={handleDateClick}
          className="w-full"
          maxDate={new Date()}
        />
      </div>

      {/* Entries Display Section */}
      <div className="solid-card space-y-4 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {selectedDate.toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {entriesForDate.length} {entriesForDate.length === 1 ? "entry" : "entries"}
          </p>
        </div>

        {/* Quick Add Form */}
        <div className="space-y-3 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-xs">
              Add purchase amount (₹)
            </Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="h-10"
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleAddEntry();
                }}
              />
              <Button
                onClick={handleAddEntry}
                disabled={!amount.trim() || isLoading}
                className="press h-10 rounded-lg gradient-warm px-4 text-sm font-semibold text-primary-foreground"
              >
                {isLoading ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </div>

        {/* Entries List */}
        {entriesForDate.length > 0 ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Entries for this date
            </p>
            <div className="space-y-2">
              {entriesForDate.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                >
                  <span className="font-semibold text-foreground">
                    ₹{entry.amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="press rounded p-1 hover:bg-destructive/10"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              ))}
            </div>

            {/* Daily Total */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">Daily total</p>
                <p className="mono-amount text-xl font-bold text-secondary">
                  {formatCurrency(dailyTotal)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t pt-4 text-center">
            <p className="text-sm text-muted-foreground">No entries for this date yet.</p>
          </div>
        )}
      </div>

      {/* Overall Total */}
      {entries.length > 0 && (
        <div className="solid-card flex items-center justify-between border-t bg-linear-to-br from-secondary/5 to-secondary/10 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Overall total
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {entries.length} {entries.length === 1 ? "entry" : "entries"} across{" "}
              {new Set(entries.map((e) => e.date)).size}{" "}
              {new Set(entries.map((e) => e.date)).size === 1 ? "day" : "days"}
            </p>
          </div>
          <p className="mono-amount text-2xl font-bold text-secondary">
            {formatCurrency(overallTotal)}
          </p>
        </div>
      )}
    </div>
  );
}

export interface Entry {
  id: string;
  customerId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  amount: number;
}

/**
 * LedgerProvider interface for abstracting entry storage (local or Supabase)
 */
export interface LedgerProvider {
  /**
   * Get all entries for a customer
   */
  getEntries(customerId: string): Promise<Entry[]>;

  /**
   * Add a new entry for a customer
   */
  addEntry(customerId: string, date: string, amount: number): Promise<Entry>;

  /**
   * Delete an entry by ID
   */
  deleteEntry(id: string): Promise<void>;
}

/**
 * Local in-memory ledger provider for testing without Supabase
 */
export class LocalLedgerProvider implements LedgerProvider {
  private entries: Map<string, Entry> = new Map();
  private idCounter = 0;

  async getEntries(customerId: string): Promise<Entry[]> {
    return Array.from(this.entries.values())
      .filter((e) => e.customerId === customerId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async addEntry(customerId: string, date: string, amount: number): Promise<Entry> {
    const id = `local-${this.idCounter++}-${Date.now()}`;
    const entry: Entry = {
      id,
      customerId,
      date,
      amount,
    };
    this.entries.set(id, entry);
    return entry;
  }

  async deleteEntry(id: string): Promise<void> {
    this.entries.delete(id);
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.entries.clear();
  }
}

/**
 * Supabase ledger provider — backed by the existing `transactions` table.
 * Each ledger entry is a transaction row (product: null, status: "unpaid").
 * The customer's balance is maintained by the tg_transactions_balance trigger.
 */
export class SupabaseLedgerProvider implements LedgerProvider {
  constructor(private supabaseClient: any) {}

  async getEntries(customerId: string): Promise<Entry[]> {
    const { data, error } = await this.supabaseClient
      .from("transactions")
      .select("id, customer_id, date_time, amount")
      .eq("customer_id", customerId)
      .order("date_time", { ascending: false });

    if (error) {
      throw new Error(error.message || "Failed to fetch entries from database");
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      customerId: row.customer_id,
      date: String(row.date_time).slice(0, 10),
      amount: Number(row.amount),
    }));
  }

  async addEntry(customerId: string, date: string, amount: number): Promise<Entry> {
    // Preserve the chosen calendar date but use current time-of-day.
    const now = new Date();
    const iso = `${date}T${now.toTimeString().slice(0, 8)}`;
    const dateTime = new Date(iso).toISOString();

    const { data, error } = await this.supabaseClient
      .from("transactions")
      .insert({
        customer_id: customerId,
        date_time: dateTime,
        amount,
        product: null,
        status: "unpaid",
      })
      .select("id, customer_id, date_time, amount")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to add entry to database");
    }

    return {
      id: data.id,
      customerId: data.customer_id,
      date: String(data.date_time).slice(0, 10),
      amount: Number(data.amount),
    };
  }

  async deleteEntry(id: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from("transactions")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message || "Failed to delete entry from database");
    }
  }
}


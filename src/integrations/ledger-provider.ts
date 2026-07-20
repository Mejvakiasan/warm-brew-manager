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
 * Supabase ledger provider for persisting entries to the database
 */
export class SupabaseLedgerProvider implements LedgerProvider {
  constructor(private supabaseClient: any) {}

  async getEntries(customerId: string): Promise<Entry[]> {
    const { data, error } = await this.supabaseClient
      .from("customer_entries")
      .select("*")
      .eq("customer_id", customerId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message || "Failed to fetch entries from database");
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      customerId: row.customer_id,
      date: row.date,
      amount: Number(row.amount),
    }));
  }

  async addEntry(customerId: string, date: string, amount: number): Promise<Entry> {
    const { data, error } = await this.supabaseClient
      .from("customer_entries")
      .insert({
        customer_id: customerId,
        date,
        amount,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Failed to add entry to database");
    }

    if (!data) {
      throw new Error("No data returned from insert");
    }

    return {
      id: data.id,
      customerId: data.customer_id,
      date: data.date,
      amount: Number(data.amount),
    };
  }

  async deleteEntry(id: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from("customer_entries")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message || "Failed to delete entry from database");
    }
  }
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { PERSIST_GC_TIME } from "@/lib/queryPersist";

export type PropertyCleanerRate = Tables<"property_cleaner_rates">;

export const payRatesQueryKey = ["property_cleaner_rates"] as const;

// One hook serves both the manager Pay screen and the cleaner's "My day" —
// RLS does the scoping: admin/manager read every rate, a technician reads only
// their own rows (and never sees what other cleaners earn).
export function usePayRates() {
  return useQuery({
    queryKey: payRatesQueryKey,
    gcTime: PERSIST_GC_TIME,
    queryFn: async (): Promise<PropertyCleanerRate[]> => {
      const { data, error } = await supabase.from("property_cleaner_rates").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertPayRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      property_id: string;
      cleaner_id: string;
      amount_cents: number;
    }): Promise<PropertyCleanerRate> => {
      const { data, error } = await supabase
        .from("property_cleaner_rates")
        .upsert(input, { onConflict: "property_id,cleaner_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payRatesQueryKey });
    },
  });
}

// Clearing a rate (back to "no rate set") removes the row.
export function useDeletePayRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("property_cleaner_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payRatesQueryKey });
    },
  });
}

// ---------------------------------------------------------------------------
// Effective-pay resolution — pure, unit-tested in payRates.test.ts.
// ---------------------------------------------------------------------------

export type RateIndex = Map<string, number>;

export const rateKey = (propertyId: string, cleanerId: string) => `${propertyId}:${cleanerId}`;

export function buildRateIndex(rates: PropertyCleanerRate[] | undefined): RateIndex {
  const m: RateIndex = new Map();
  for (const r of rates ?? []) m.set(rateKey(r.property_id, r.cleaner_id), r.amount_cents);
  return m;
}

// What a job pays the cleaner:
//   1. a manual per-job override (cleaning_jobs.amount_cents) always wins
//   2. else the configured (property, cleaner) rate
//   3. else null — "unpriced", surfaced in the UI so it gets set
export function effectivePayCents(
  job: { property_id: string | null; cleaner_id: string | null; amount_cents: number | null },
  index: RateIndex,
): number | null {
  if (job.amount_cents != null) return job.amount_cents;
  if (job.property_id && job.cleaner_id) {
    const rate = index.get(rateKey(job.property_id, job.cleaner_id));
    if (rate != null) return rate;
  }
  return null;
}

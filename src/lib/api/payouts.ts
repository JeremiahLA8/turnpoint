import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { PERSIST_GC_TIME } from "@/lib/queryPersist";

export type CleanerPayout = Tables<"cleaner_payouts">;

// Payment methods for the manual Phase-1 rail. Free text in the DB so a future
// automated rail can write its own value, but these are the picker options.
export const PAYOUT_METHODS = ["zelle", "quickbooks", "check", "venmo", "cash", "other"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_METHOD_LABEL: Record<string, string> = {
  zelle: "Zelle",
  quickbooks: "QuickBooks",
  check: "Check",
  venmo: "Venmo",
  cash: "Cash",
  other: "Other",
  dwolla: "ACH (Dwolla)",
};

export const payoutsQueryKey = ["cleaner_payouts"] as const;

// RLS scopes this: admin/manager get every payout, a technician gets only their
// own (so a cleaner can see their paid history).
export function usePayouts() {
  return useQuery({
    queryKey: payoutsQueryKey,
    gcTime: PERSIST_GC_TIME,
    queryFn: async (): Promise<CleanerPayout[]> => {
      const { data, error } = await supabase
        .from("cleaner_payouts")
        .select("*")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecordPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      job_id: string;
      cleaner_id: string;
      property_id: string | null;
      amount_cents: number;
      method: string;
      note?: string | null;
      paid_at?: string;
    }): Promise<CleanerPayout> => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("cleaner_payouts")
        .insert({
          job_id: input.job_id,
          cleaner_id: input.cleaner_id,
          property_id: input.property_id,
          amount_cents: input.amount_cents,
          method: input.method,
          note: input.note ?? null,
          paid_at: input.paid_at ?? new Date().toISOString(),
          recorded_by: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payoutsQueryKey });
    },
  });
}

// Phase 1b — book one or more recorded payouts into QuickBooks as expenses.
// Invokes the `qb-book-payout` edge function (it holds the QB creds; the client
// never touches them). Idempotent on the server: an already-booked payout is
// skipped. Decoupled from useRecordPayout on purpose — a QB hiccup must never
// block logging that the crew was paid, so callers record first, then book and
// tolerate a booking failure (the Pay hub offers a retry).
export type BookResult = {
  payout_id: string;
  status: "booked" | "skipped" | "error";
  purchase_id?: string;
  error?: string;
};

export function useBookPayouts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payoutIds: string[]): Promise<BookResult[]> => {
      if (payoutIds.length === 0) return [];
      const { data, error } = await supabase.functions.invoke("qb-book-payout", {
        body: { payout_ids: payoutIds },
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || "QuickBooks booking failed");
      return (data?.results ?? []) as BookResult[];
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: payoutsQueryKey });
    },
  });
}

// Payouts recorded but not yet booked into QuickBooks (the retry queue).
export function unbookedPayouts(payouts: CleanerPayout[] | undefined): CleanerPayout[] {
  return (payouts ?? []).filter((p) => !p.qb_purchase_id);
}

// ACH payments that failed or bounced back — the cleaner was NOT paid. Surfaced
// loudly so a bounced disbursement never goes unnoticed.
export function failedAchPayouts(payouts: CleanerPayout[] | undefined): CleanerPayout[] {
  return (payouts ?? []).filter((p) => p.dwolla_status === "failed" || p.dwolla_status === "returned");
}

// ---------------------------------------------------------------------------
// Phase 2 — Dwolla ACH (direct deposit to the crew).
// ---------------------------------------------------------------------------

export type CleanerDwolla = Tables<"cleaner_dwolla">;
export const cleanerDwollaQueryKey = ["cleaner_dwolla"] as const;

// Which cleaners have direct deposit set up. RLS: admin/manager see all,
// a technician sees only their own.
export function useCleanerDwolla() {
  return useQuery({
    queryKey: cleanerDwollaQueryKey,
    queryFn: async (): Promise<CleanerDwolla[]> => {
      const { data, error } = await supabase.from("cleaner_dwolla").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function dwollaByCleaner(rows: CleanerDwolla[] | undefined): Map<string, CleanerDwolla> {
  const m = new Map<string, CleanerDwolla>();
  for (const r of rows ?? []) m.set(r.cleaner_id, r);
  return m;
}

// Set up (or update) a cleaner's bank for direct deposit. Raw bank numbers go
// to Dwolla via the edge function and are never stored in our DB.
export function useOnboardCleanerBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      cleaner_id: string;
      routingNumber: string;
      accountNumber: string;
      bankAccountType: "checking" | "savings";
    }): Promise<{ last4: string }> => {
      const { data, error } = await supabase.functions.invoke("dwolla-onboard-cleaner", { body: input });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || "Couldn't set up direct deposit");
      return { last4: data.last4 };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cleanerDwollaQueryKey }),
  });
}

export type AchResult = { payout_id: string; status: "sent" | "skipped" | "error"; transfer_id?: string; error?: string };

// Send one or more recorded payouts by real ACH via Dwolla. Idempotent server-side.
export function usePayViaAch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payoutIds: string[]): Promise<AchResult[]> => {
      if (payoutIds.length === 0) return [];
      const { data, error } = await supabase.functions.invoke("dwolla-pay", { body: { payout_ids: payoutIds } });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || "ACH payment failed");
      return (data?.results ?? []) as AchResult[];
    },
    onSettled: () => qc.invalidateQueries({ queryKey: payoutsQueryKey }),
  });
}

// Undo a payout (e.g. recorded the wrong clean).
export function useDeletePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("cleaner_payouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payoutsQueryKey });
    },
  });
}

// Set of job_ids that have at least one "after" photo — the proof-of-work gate
// for paying out (a clean is only "ready to pay" once photos are submitted).
export const afterPhotoJobIdsQueryKey = ["after_photo_job_ids"] as const;

export function useAfterPhotoJobIds() {
  return useQuery({
    queryKey: afterPhotoJobIdsQueryKey,
    gcTime: PERSIST_GC_TIME,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("job_photos")
        .select("job_id")
        .eq("type", "after");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.job_id));
    },
  });
}

// Index payouts by the job they settled.
export function buildPaidByJob(payouts: CleanerPayout[] | undefined): Map<string, CleanerPayout> {
  const m = new Map<string, CleanerPayout>();
  for (const p of payouts ?? []) m.set(p.job_id, p);
  return m;
}

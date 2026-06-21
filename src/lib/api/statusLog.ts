// Phase 7 — read-only audit log for cleaning_jobs.status transitions.
//
// Backed by the job_status_log table, which a Postgres trigger writes to
// every time cleaning_jobs.status changes. The trigger also records the
// auth.uid() of whoever caused the change.
//
// The notify-unacknowledged-jobs edge function piggybacks on this table
// for dedupe (rows with notes='acknowledge_reminder_sent' and
// from_status == to_status). We filter those out here so the UI timeline
// only shows real transitions.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type JobStatusLogEntry = Tables<"job_status_log"> & {
  changed_by_profile: Pick<Tables<"profiles">, "id" | "full_name"> | null;
};

export function useJobStatusLog(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job_status_log", jobId],
    enabled: !!jobId,
    queryFn: async (): Promise<JobStatusLogEntry[]> => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("job_status_log")
        .select("*, changed_by_profile:profiles!job_status_log_changed_by_fkey(id, full_name)")
        .eq("job_id", jobId)
        .order("changed_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as JobStatusLogEntry[];
      // Drop dedupe-only rows (no real transition).
      return rows.filter((r) => r.from_status !== r.to_status || r.from_status === null);
    },
  });
}

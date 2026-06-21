import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { PERSIST_GC_TIME } from "@/lib/queryPersist";
import { enqueueJobPatch, isNetworkError } from "@/lib/offlineQueue";
import {
  notifyCleanerAssigned,
  notifyCleanerUnassigned,
  notifyManagersJobAcknowledged,
  notifyManagersJobCompleted,
  notifyManagersJobStarted,
  notifyManagersJobDeclined,
  notifyCleanerJobApproved,
} from "./notifications";

export type CleaningJob = Tables<"cleaning_jobs">;
export type CleaningJobInsert = TablesInsert<"cleaning_jobs">;
export type CleaningJobUpdate = TablesUpdate<"cleaning_jobs">;
export type JobStatus = CleaningJob["status"];

// Active statuses Phase 7 expects the app to write. 'scheduled' is kept in the
// DB enum for backwards compatibility but the app should not write it.
export const ACTIVE_JOB_STATUSES = [
  "pending",
  "assigned",
  "acknowledged",
  "in_progress",
  "completed",
  "approved",
  "cancelled",
] as const satisfies readonly JobStatus[];

export type CleaningJobWithRelations = CleaningJob & {
  property: Pick<Tables<"properties">, "id" | "name" | "nickname" | "color" | "access_notes" | "checklist_template_id"> | null;
  cleaner: Pick<Tables<"profiles">, "id" | "full_name"> | null;
};

// Back-compat alias for the previous narrower shape
export type CleaningJobWithProperty = CleaningJobWithRelations;

export const jobsQueryKey = ["cleaning_jobs"] as const;

const SELECT_WITH_RELATIONS =
  "*, property:properties(id, name, nickname, color, access_notes, checklist_template_id), cleaner:profiles(id, full_name)" as const;

export function useJobs() {
  return useQuery({
    queryKey: jobsQueryKey,
    gcTime: PERSIST_GC_TIME,
    // Booking data changes server-side (Hostaway webhook + the 15-min sync
    // cron). Poll so an open board reflects new/changed turns without a manual
    // refresh. Only while the tab is focused — don't burn requests in the
    // background or wake a sleeping cleaner's phone.
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<CleaningJobWithRelations[]> => {
      const { data, error } = await supabase
        .from("cleaning_jobs")
        .select(SELECT_WITH_RELATIONS)
        .order("scheduled_start", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CleaningJobWithRelations[];
    },
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: [...jobsQueryKey, id],
    enabled: !!id,
    gcTime: PERSIST_GC_TIME,
    queryFn: async (): Promise<CleaningJobWithRelations | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("cleaning_jobs")
        .select(SELECT_WITH_RELATIONS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as CleaningJobWithRelations | null;
    },
  });
}

export function useJobsForProperty(propertyId: string | undefined) {
  return useQuery({
    queryKey: [...jobsQueryKey, "by-property", propertyId],
    enabled: !!propertyId,
    queryFn: async (): Promise<CleaningJob[]> => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from("cleaning_jobs")
        .select("*")
        .eq("property_id", propertyId)
        .order("scheduled_start", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CleaningJobInsert): Promise<CleaningJob> => {
      const { data, error } = await supabase
        .from("cleaning_jobs")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: jobsQueryKey });
    },
  });
}

// Merge a patch into every cached copy of a job (list + single-job views) so the
// cleaner sees the change immediately — used for offline-queued optimistic writes.
export function applyJobPatchToCache(qc: QueryClient, id: string, patch: CleaningJobUpdate) {
  qc.setQueryData<CleaningJobWithRelations[]>(jobsQueryKey, (old) =>
    old?.map((j) => (j.id === id ? { ...j, ...patch } : j)),
  );
  qc.setQueryData<CleaningJobWithRelations | null>([...jobsQueryKey, id], (old) =>
    old ? { ...old, ...patch } : old,
  );
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: CleaningJobUpdate;
      // When set, suppress the built-in SMS dispatch — the caller owns
      // notifications (e.g. a decline fires its own manager alert).
      silent?: boolean;
    }): Promise<{ updated: CleaningJob; prev: CleaningJobWithRelations | null; queued: boolean }> => {
      // Grab the pre-update row from cache so we can detect transitions
      // (assigned / unassigned / acknowledged / started / completed / approved)
      // and route the right SMS.
      const prev = findCachedJob(qc, id);

      try {
        const { data, error } = await supabase
          .from("cleaning_jobs")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return { updated: data, prev, queued: false };
      } catch (e) {
        // No signal? Queue the patch and optimistically apply it so the cleaner's
        // day keeps moving; the offline sync replays it when back online. A real
        // server rejection (RLS/validation) still throws.
        if (isNetworkError(e)) {
          await enqueueJobPatch(id, patch);
          const optimistic = (prev ? { ...prev, ...patch } : { id, ...patch }) as CleaningJob;
          return { updated: optimistic, prev, queued: true };
        }
        throw e;
      }
    },
    onSuccess: ({ updated, prev, queued }, vars) => {
      if (queued) {
        // Offline: don't invalidate (a refetch would clobber the optimistic row);
        // don't fire SMS (no signal). The sync handles both on reconnect.
        applyJobPatchToCache(qc, vars.id, vars.patch);
        return;
      }
      qc.invalidateQueries({ queryKey: jobsQueryKey });
      qc.invalidateQueries({ queryKey: [...jobsQueryKey, vars.id] });
      qc.invalidateQueries({ queryKey: ["job_status_log", vars.id] });
      // Fire-and-forget SMS notifications. Errors are logged inside helpers.
      if (!vars.silent) void fireJobNotifications(prev, updated);
    },
  });
}

// Convenience wrappers around useUpdateJob — these encode the small bits of
// business logic that should always travel together with a transition
// (timestamps, status combinations). They let the UI layer stay declarative.

export function useAcknowledgeJob() {
  const update = useUpdateJob();
  return {
    ...update,
    mutate: (id: string) => update.mutate({ id, patch: { status: "acknowledged" } }),
    mutateAsync: (id: string) => update.mutateAsync({ id, patch: { status: "acknowledged" } }),
  };
}

// Cleaner declines an invite: the turn goes back to unassigned (status →
// pending, cleaner cleared) so it resurfaces on the manager's board, and the
// managers get a decline alert. Takes the full job so we still know who
// declined after the cleaner_id is cleared. `silent` suppresses the generic
// "unassigned" SMS to the declining cleaner — we send the manager alert here.
export function useDeclineJob() {
  const update = useUpdateJob();
  const vars = (job: CleaningJobWithRelations) => ({
    id: job.id,
    patch: { status: "pending" as const, cleaner_id: null },
    silent: true,
  });
  const alert = (job: CleaningJobWithRelations) =>
    void notifyManagersJobDeclined({
      propertyName: job.property?.nickname || job.property?.name || "your property",
      scheduledStart: job.scheduled_start,
      cleanerName: job.cleaner?.full_name ?? null,
    });
  return {
    ...update,
    mutate: (job: CleaningJobWithRelations) => { alert(job); update.mutate(vars(job)); },
    mutateAsync: (job: CleaningJobWithRelations) => { alert(job); return update.mutateAsync(vars(job)); },
  };
}

export function useApproveJob() {
  const update = useUpdateJob();
  return {
    ...update,
    mutate: (id: string) =>
      update.mutate({ id, patch: { status: "approved", approved_at: new Date().toISOString() } }),
    mutateAsync: (id: string) =>
      update.mutateAsync({ id, patch: { status: "approved", approved_at: new Date().toISOString() } }),
  };
}

export function useUnapproveJob() {
  // Per Phase 7 decision: un-approve sends the job back to in_progress so
  // the cleaner can re-edit photos/checklist, then re-complete and be
  // re-reviewed.
  const update = useUpdateJob();
  return {
    ...update,
    mutate: (id: string) =>
      update.mutate({ id, patch: { status: "in_progress", approved_at: null, completed_at: null } }),
    mutateAsync: (id: string) =>
      update.mutateAsync({ id, patch: { status: "in_progress", approved_at: null, completed_at: null } }),
  };
}

function findCachedJob(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
): CleaningJobWithRelations | null {
  const list = qc.getQueryData<CleaningJobWithRelations[]>(jobsQueryKey);
  if (list) {
    const hit = list.find((j) => j.id === id);
    if (hit) return hit;
  }
  return qc.getQueryData<CleaningJobWithRelations | null>([...jobsQueryKey, id]) ?? null;
}

async function fireJobNotifications(
  prev: CleaningJobWithRelations | null,
  updated: CleaningJob,
): Promise<void> {
  if (!prev) return;

  const propertyName = prev.property?.nickname || prev.property?.name || "your property";
  const cleanerName = prev.cleaner?.full_name ?? null;

  const cleanerChanged = prev.cleaner_id !== updated.cleaner_id;
  if (cleanerChanged) {
    // Old cleaner: notify they've been unassigned (only if there was one).
    if (prev.cleaner_id) {
      void notifyCleanerUnassigned(prev.cleaner_id, {
        propertyName,
        scheduledStart: updated.scheduled_start,
      });
    }
    // New cleaner: notify they've been assigned.
    if (updated.cleaner_id) {
      void notifyCleanerAssigned(updated.cleaner_id, {
        propertyName,
        scheduledStart: updated.scheduled_start,
      });
    }
  }

  const statusChanged = prev.status !== updated.status;
  if (!statusChanged) return;

  // Acknowledged → notify managers (gives them confidence the cleaner saw the job).
  if (updated.status === "acknowledged") {
    void notifyManagersJobAcknowledged({
      propertyName,
      scheduledStart: updated.scheduled_start,
      cleanerName,
    });
  }

  // In progress → notify managers the clean has started.
  if (updated.status === "in_progress") {
    void notifyManagersJobStarted({
      propertyName,
      scheduledStart: updated.scheduled_start,
      cleanerName,
    });
  }

  // Completed → notify managers it's ready for review.
  if (updated.status === "completed") {
    void notifyManagersJobCompleted({
      propertyName,
      scheduledStart: updated.scheduled_start,
      cleanerName,
    });
  }

  // Approved → notify the cleaner their work was signed off.
  if (updated.status === "approved" && updated.cleaner_id) {
    void notifyCleanerJobApproved(updated.cleaner_id, {
      propertyName,
      scheduledStart: updated.scheduled_start,
    });
  }
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("cleaning_jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: jobsQueryKey });
    },
  });
}

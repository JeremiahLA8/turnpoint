// Phase 7 — read-only timeline of every status transition for a job.
//
// Backed by useJobStatusLog (job_status_log table + Postgres trigger).

import { useJobStatusLog } from "@/lib/api/statusLog";
import type { JobStatus } from "@/lib/api/jobs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  completed: "Completed",
  approved: "Approved",
  cancelled: "Cancelled",
  scheduled: "Scheduled",
};

const STATUS_DOT: Record<JobStatus, string> = {
  pending: "bg-slate-400",
  assigned: "bg-sky-500",
  acknowledged: "bg-blue-500",
  in_progress: "bg-amber-500",
  completed: "bg-emerald-500",
  approved: "bg-emerald-700",
  cancelled: "bg-rose-500",
  scheduled: "bg-sky-500",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function JobStatusHistory({ jobId }: { jobId: string }) {
  const { data: log = [], isLoading, error } = useJobStatusLog(jobId);

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-destructive">
        Failed to load history: {error.message}
      </p>
    );
  }

  if (log.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No status transitions yet.</p>;
  }

  return (
    <ol className="space-y-1.5 max-h-48 overflow-y-auto rounded-md border border-border bg-muted/20 p-2.5 text-xs">
      {log.slice().reverse().map((entry) => {
        const who = entry.changed_by_profile?.full_name ?? (entry.changed_by ? "Someone" : "System");
        return (
          <li key={entry.id} className="flex items-start gap-2">
            <span className={cn("mt-1 h-2 w-2 rounded-full shrink-0", STATUS_DOT[entry.to_status])} />
            <div className="flex-1 min-w-0">
              <div className="font-medium">
                {entry.from_status ? (
                  <>
                    <span className="text-muted-foreground">{STATUS_LABEL[entry.from_status]}</span>
                    {" → "}
                  </>
                ) : (
                  <span className="text-muted-foreground">Created · </span>
                )}
                {STATUS_LABEL[entry.to_status]}
              </div>
              <div className="text-muted-foreground text-[10px] font-mono">
                {formatWhen(entry.changed_at)} · {who}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

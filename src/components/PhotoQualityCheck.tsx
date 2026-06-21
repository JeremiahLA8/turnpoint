// Phase C — AI photo quality check panel (manager review).
//
// Runs a vision pass over the job's after-photos and shows a clean/guest-ready
// score + flagged issues. Re-runnable. Renders next to the photo viewer.

import { toast } from "sonner";
import { useJobAssessment, useAssessPhotos, issuesOf } from "@/lib/api/photoAssessment";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, ShieldAlert } from "lucide-react";

export function PhotoQualityCheck({ jobId }: { jobId: string }) {
  const { data: assessment, isLoading } = useJobAssessment(jobId);
  const assess = useAssessPhotos();

  async function run() {
    try {
      await assess.mutateAsync(jobId);
    } catch (e) {
      toast.error(`AI check failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  const issues = issuesOf(assessment);
  const pass = assessment?.verdict === "pass";

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" /> AI quality check
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={assess.isPending}>
          {assess.isPending ? "Checking…" : assessment ? "Re-run" : "Run AI check"}
        </Button>
      </div>

      {isLoading ? null : assessment ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {pass ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            )}
            <span className={`text-sm font-semibold ${pass ? "text-emerald-700" : "text-amber-700"}`}>
              {assessment.score}/100 · {pass ? "Guest-ready" : "Needs a look"}
            </span>
          </div>
          {assessment.summary && <p className="text-xs text-muted-foreground">{assessment.summary}</p>}
          {issues.length > 0 && (
            <ul className="text-xs space-y-1">
              {issues.map((it, i) => (
                <li key={i} className="text-amber-700">
                  <span className="font-medium">Photo {it.photo}:</span> {it.issue}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-muted-foreground">
            AI estimate from the after-photos — a guide, not a guarantee.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Run an AI pass over the after-photos to score how clean and guest-ready the space looks.
        </p>
      )}
    </div>
  );
}

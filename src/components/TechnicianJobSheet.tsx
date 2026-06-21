import { useEffect, useMemo, useRef, useState } from "react";
import { useUpdateJob, useDeclineJob, type CleaningJobWithRelations, type JobStatus } from "@/lib/api/jobs";
import {
  usePhotos,
  useUploadPhoto,
  useDeletePhoto,
  type JobPhotoType,
  type JobPhotoWithUrl,
} from "@/lib/api/photos";
import { ChecklistDisplay, useChecklistProgress } from "@/components/ChecklistDisplay";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
  ImagePlus,
  AlertTriangle,
  Clock,
  KeyRound,
  Loader2,
  X,
  Hand,
  ShieldCheck,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusMeta: Record<JobStatus, { label: string; tone: string }> = {
  pending: { label: "Unassigned", tone: "bg-muted text-muted-foreground" },
  assigned: { label: "Assigned to you", tone: "bg-secondary text-foreground" },
  acknowledged: { label: "Acknowledged", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  in_progress: { label: "In progress", tone: "bg-primary/15 text-primary" },
  completed: { label: "Completed", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  approved: { label: "Approved", tone: "bg-emerald-600/20 text-emerald-700 dark:text-emerald-400" },
  cancelled: { label: "Cancelled", tone: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", tone: "bg-secondary text-foreground" },
};

const formatRange = (startIso: string, endIso: string | null) => {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const day = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const s = start.toLocaleTimeString(undefined, opts);
  const e = end?.toLocaleTimeString(undefined, opts);
  return { day, time: e ? `${s} – ${e}` : s };
};

export const TechnicianJobSheet = ({
  job,
  onClose,
}: {
  job: CleaningJobWithRelations | null;
  onClose: () => void;
}) => {
  const updateJob = useUpdateJob();
  const declineJob = useDeclineJob();
  const photosQuery = usePhotos(job?.id);
  const checklistProgress = useChecklistProgress(
    job?.id ?? "",
    job?.property?.checklist_template_id ?? null,
  );
  const [notes, setNotes] = useState("");
  const [issueFlagged, setIssueFlagged] = useState(false);
  const [issueNote, setIssueNote] = useState("");
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  useEffect(() => {
    setNotes(job?.cleaner_notes ?? "");
  }, [job?.id, job?.cleaner_notes]);

  useEffect(() => {
    setIssueFlagged(job?.issue_flagged ?? false);
    setIssueNote(job?.issue_note ?? "");
  }, [job?.id, job?.issue_flagged, job?.issue_note]);

  const { beforePhotos, afterPhotos } = useMemo(() => {
    const all = photosQuery.data ?? [];
    return {
      beforePhotos: all.filter((p) => p.type === "before"),
      afterPhotos: all.filter((p) => p.type === "after"),
    };
  }, [photosQuery.data]);

  if (!job) return null;

  const propertyName = job.property?.nickname ?? job.property?.name ?? "—";
  const propertyColor = job.property?.color ?? "bg-slate-300 text-slate-900";
  const accessNotes = job.property?.access_notes ?? "";
  const status = job.status;
  const meta = statusMeta[status];
  // 'approved' joins completed/cancelled as a terminal state for the cleaner.
  const isDone = status === "completed" || status === "cancelled" || status === "approved";
  const { day, time } = formatRange(job.scheduled_start, job.scheduled_end);

  const checklistIncomplete =
    checklistProgress.total > 0 && checklistProgress.done < checklistProgress.total;
  const noAfterPhotos = afterPhotos.length === 0;

  const setStatus = async (next: JobStatus) => {
    // Intercept Complete if checklist isn't 100% OR there are no After photos.
    // Surface one combined confirm dialog covering both.
    if (next === "completed" && (checklistIncomplete || noAfterPhotos)) {
      setConfirmCompleteOpen(true);
      return;
    }
    await doStatusChange(next);
  };

  const doStatusChange = async (next: JobStatus) => {
    const patch: Parameters<typeof updateJob.mutateAsync>[0]["patch"] = { status: next };
    if (next === "in_progress") {
      patch.started_at = new Date().toISOString();
    } else if (next === "completed") {
      patch.completed_at = new Date().toISOString();
      patch.cleaner_notes = notes.trim() ? notes.trim() : null;
      // Persist whatever the cleaner left in the issue panel, so it can't be
      // lost by forgetting to hit Save before completing.
      patch.issue_flagged = issueFlagged;
      patch.issue_note = issueFlagged ? issueNote.trim() || null : null;
    } else if (next === "assigned") {
      // Reopen: clear timestamps so a fresh start/complete records new ones.
      patch.started_at = null;
      patch.completed_at = null;
    }
    try {
      await updateJob.mutateAsync({ id: job.id, patch });
      const labels: Partial<Record<JobStatus, string>> = {
        acknowledged: "acknowledged",
        in_progress: "started",
        completed: "marked complete",
        cancelled: "cancelled",
        assigned: "reopened",
      };
      toast.success(`${propertyName} ${labels[next] ?? next}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update job");
    }
  };

  const saveNotes = async () => {
    const trimmed = notes.trim();
    try {
      await updateJob.mutateAsync({
        id: job.id,
        patch: { cleaner_notes: trimmed || null },
      });
      toast.success("Notes saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save notes");
    }
  };

  const saveIssue = async () => {
    try {
      await updateJob.mutateAsync({
        id: job.id,
        patch: {
          issue_flagged: issueFlagged,
          issue_note: issueFlagged ? issueNote.trim() || null : null,
        },
      });
      toast.success(issueFlagged ? "Issue flagged for your manager" : "Issue cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save issue");
    }
  };

  const issueDirty =
    issueFlagged !== (job.issue_flagged ?? false) ||
    issueNote.trim() !== (job.issue_note ?? "").trim();

  return (
    <>
    <Sheet open={!!job} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md flex flex-col">
        <SheetHeader>
          <div className={`${propertyColor} h-1.5 w-12 rounded-full mb-3`} />
          <SheetTitle className="truncate">{propertyName}</SheetTitle>
          <SheetDescription className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {time}
            </span>
            <Badge variant="outline" className="font-mono text-[10px]">{day}</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5 flex-1 overflow-y-auto px-1 pb-2">
          <div className={cn("inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium", meta.tone)}>
            {meta.label}
          </div>

          {status === "pending" && (
            <p className="text-xs text-muted-foreground">
              This job hasn't been assigned to a cleaner yet. Your manager
              will assign someone shortly.
            </p>
          )}

          {!isDone && status !== "pending" && (
            <div className="grid grid-cols-2 gap-2">
              {status === "assigned" && (
                <>
                  <Button onClick={() => setStatus("acknowledged")} disabled={updateJob.isPending || declineJob.isPending} className="gap-1.5">
                    {updateJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Accept
                  </Button>
                  <Button variant="outline" onClick={() => setDeclineOpen(true)} disabled={updateJob.isPending || declineJob.isPending} className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10">
                    {declineJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Decline
                  </Button>
                </>
              )}
              {status === "acknowledged" && (
                <Button onClick={() => setStatus("in_progress")} disabled={updateJob.isPending} className="gap-1.5">
                  {updateJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                  Start job
                </Button>
              )}
              {status === "in_progress" && (
                <Button onClick={() => setStatus("completed")} disabled={updateJob.isPending} className="gap-1.5">
                  {updateJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Mark complete
                </Button>
              )}
              {status !== "assigned" && (
                <Button
                  variant="outline"
                  onClick={() => setStatus("cancelled")}
                  disabled={updateJob.isPending}
                  className="gap-1.5"
                >
                  <XCircle className="h-4 w-4" /> Cancel
                </Button>
              )}
            </div>
          )}

          {status === "approved" && (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Approved by your manager — this job is locked.
            </p>
          )}
          {(status === "completed" || status === "cancelled") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatus("assigned")}
              disabled={updateJob.isPending}
              className="gap-1.5"
            >
              Reopen job
            </Button>
          )}

          {accessNotes && (
            <section className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <KeyRound className="h-3 w-3" /> Access notes
              </div>
              <p className="text-sm whitespace-pre-wrap">{accessNotes}</p>
            </section>
          )}

          {job.notes && (
            <section className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Notes from your manager
              </div>
              <p className="text-sm whitespace-pre-wrap rounded-md border border-border bg-card p-3">
                {job.notes}
              </p>
            </section>
          )}

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Your notes</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={saveNotes}
                disabled={updateJob.isPending || (notes.trim() === (job.cleaner_notes ?? "").trim())}
              >
                Save
              </Button>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
              placeholder="Anything the manager should know? These notes save automatically when you mark the job complete."
              rows={4}
              maxLength={1000}
            />
            <div className="text-[10px] text-muted-foreground text-right font-mono">
              {notes.length}/1000
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Checklist</h3>
              {checklistProgress.total > 0 && (
                <span className="text-xs font-mono text-muted-foreground">
                  {checklistProgress.done}/{checklistProgress.total}
                </span>
              )}
            </div>
            <ChecklistDisplay
              jobId={job.id}
              templateId={job.property?.checklist_template_id ?? null}
              readOnly={isDone}
            />
          </section>

          <PhotoSection
            jobId={job.id}
            type="before"
            label="Before photos"
            description="Snap before-cleaning shots so the team can see the starting condition."
            photos={beforePhotos}
            loading={photosQuery.isLoading}
            disabled={isDone}
          />

          <PhotoSection
            jobId={job.id}
            type="after"
            label="After photos"
            description="Snap after-cleaning shots so your manager can see the finished work."
            photos={afterPhotos}
            loading={photosQuery.isLoading}
            disabled={isDone}
          />

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Issue / damage
              </h3>
              {!isDone && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={saveIssue}
                  disabled={updateJob.isPending || !issueDirty}
                >
                  Save
                </Button>
              )}
            </div>

            {isDone ? (
              job.issue_flagged ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <div className="font-medium text-amber-700 dark:text-amber-400 inline-flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Issue reported
                  </div>
                  {job.issue_note && <p className="mt-1 whitespace-pre-wrap">{job.issue_note}</p>}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No issues reported for this clean.</p>
              )
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIssueFlagged((v) => !v)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-md border p-3 text-sm text-left transition",
                    issueFlagged ? "border-amber-500/50 bg-amber-500/10" : "border-border hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded-sm border flex items-center justify-center shrink-0",
                      issueFlagged ? "bg-amber-500 border-amber-500 text-white" : "border-muted-foreground/40",
                    )}
                  >
                    {issueFlagged && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="font-medium">Flag damage or an issue at this property</span>
                </button>
                {issueFlagged && (
                  <Textarea
                    value={issueNote}
                    onChange={(e) => setIssueNote(e.target.value.slice(0, 1000))}
                    placeholder="What's the issue? e.g. cracked glass on the patio table, stain on the master bedding. Add photos in the After section above."
                    rows={3}
                    maxLength={1000}
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  Flagged issues show up on the owner's report. Saved automatically when you mark the job complete.
                </p>
              </>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>

    <AlertDialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Complete this job?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Before you mark <strong>{propertyName}</strong> complete, a few
                things look unfinished:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {checklistIncomplete && (
                  <li>
                    Checklist is {checklistProgress.done}/{checklistProgress.total} done
                    — {checklistProgress.total - checklistProgress.done} task
                    {checklistProgress.total - checklistProgress.done === 1 ? "" : "s"} left.
                  </li>
                )}
                {noAfterPhotos && <li>No After photos uploaded yet.</li>}
              </ul>
              <p>
                You can mark it complete anyway — your manager may follow up — or
                go back and finish the remaining items.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Go back</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setConfirmCompleteOpen(false);
              doStatusChange("completed");
            }}
          >
            Complete anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={declineOpen} onOpenChange={setDeclineOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Decline this job?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{propertyName}</strong> will go back to your manager as
            unassigned, and they'll be notified you declined. You won't see it on
            your schedule. This can't be undone from here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              setDeclineOpen(false);
              if (!job) return;
              declineJob.mutateAsync(job)
                .then(() => { toast.success(`Declined ${propertyName}`); onClose(); })
                .catch((e) => toast.error(e instanceof Error ? e.message : "Could not decline"));
            }}
          >
            Decline job
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

function PhotoSection({
  jobId,
  type,
  label,
  description,
  photos,
  loading,
  disabled,
}: {
  jobId: string;
  type: JobPhotoType;
  label: string;
  description: string;
  photos: JobPhotoWithUrl[];
  loading: boolean;
  disabled: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const [uploading, setUploading] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let okCount = 0;
    try {
      for (const file of Array.from(files)) {
        try {
          await uploadPhoto.mutateAsync({ jobId, type, file });
          okCount++;
        } catch (e) {
          toast.error(
            `Failed to upload ${file.name}: ${e instanceof Error ? e.message : "unknown error"}`,
          );
        }
      }
      if (okCount > 0) {
        toast.success(`${okCount} ${type} photo${okCount === 1 ? "" : "s"} uploaded`);
      }
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (photo: JobPhotoWithUrl) => {
    try {
      await deletePhoto.mutateAsync(photo);
      toast.success("Photo removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove photo");
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          className="gap-1.5"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Add
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="relative group aspect-square rounded-md overflow-hidden border border-border block"
            >
              <img src={p.url} alt={`${type} photo`} className="w-full h-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(p);
                  }}
                  className="absolute top-1 right-1 bg-background/90 border border-border rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

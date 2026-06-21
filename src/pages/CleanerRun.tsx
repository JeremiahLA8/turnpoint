// Turnpoint — Cleaner Run ("My day"). Screen 2 of the two hero screens.
//
// The cleaner's whole day on one screen: an "Up next" hero card with the next
// job to work, then the rest of the day in order. Pay is shown up front and a
// running daily total sits at the top — the deliberate anti-Turno (no hidden
// fees, no clawbacks). Tapping any job opens the existing TechnicianJobSheet,
// which already drives the full state machine (acknowledge/start/complete),
// checklist, and before/after photos.
//
// Data: useJobs() is RLS-filtered to the signed-in cleaner's own jobs.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useJobs, type CleaningJobWithRelations } from "@/lib/api/jobs";
import { usePayRates, buildRateIndex, effectivePayCents } from "@/lib/api/payRates";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { TechnicianJobSheet } from "@/components/TechnicianJobSheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KeyRound, Clock, ChevronRight, CheckCircle2, Sunrise } from "lucide-react";

const ACTIONABLE = ["assigned", "acknowledged", "in_progress"] as const;
const TERMINAL = ["completed", "approved", "cancelled"] as const;

const STATUS: Record<string, { label: string; dot: string; pill: string }> = {
  pending: { label: "Awaiting assignment", dot: "bg-muted-foreground/40", pill: "bg-foreground/5 text-muted-foreground" },
  assigned: { label: "Invite — accept or decline", dot: "bg-warning", pill: "bg-warning/15 text-amber-700" },
  acknowledged: { label: "Ready to start", dot: "bg-sky-500", pill: "bg-sky-500/15 text-sky-700" },
  in_progress: { label: "In progress", dot: "bg-primary", pill: "bg-primary/15 text-primary" },
  completed: { label: "Submitted for review", dot: "bg-emerald-500", pill: "bg-emerald-500/15 text-emerald-700" },
  approved: { label: "Approved", dot: "bg-emerald-600", pill: "bg-emerald-600/15 text-emerald-700" },
  cancelled: { label: "Cancelled", dot: "bg-muted-foreground/30", pill: "bg-foreground/5 text-muted-foreground line-through" },
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const fmtRange = (start: string, end: string | null) =>
  end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start);
const fmtMoney = (cents: number | null) => (cents == null ? null : `$${Math.round(cents / 100)}`);
const propName = (j: CleaningJobWithRelations) =>
  j.property?.nickname ?? j.property?.name ?? "Property";

function actionLabel(status: string) {
  if (status === "assigned") return "Review invite";
  if (status === "acknowledged") return "Start clean";
  if (status === "in_progress") return "Continue clean";
  return "Open job";
}

export default function CleanerRun() {
  const { user } = useAuth();
  const { data: jobs, isLoading, error } = useJobs();
  const { data: rates } = usePayRates();
  const rateIndex = useMemo(() => buildRateIndex(rates), [rates]);
  const [selectedJob, setSelectedJob] = useState<CleaningJobWithRelations | null>(null);

  const { data: profileName } = useQuery({
    queryKey: ["my_profile_name", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data?.full_name ?? null;
    },
  });

  const firstName = (
    profileName ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "there"
  ).split(" ")[0];

  const today = startOfDay(new Date());

  const todaysJobs = useMemo(
    () =>
      (jobs ?? [])
        .filter(
          (j) =>
            j.scheduled_start &&
            sameDay(new Date(j.scheduled_start), today) &&
            j.status !== "cancelled",
        )
        .sort(
          (a, b) =>
            new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
        ),
    [jobs, today],
  );

  const total = todaysJobs.reduce((sum, j) => sum + (effectivePayCents(j, rateIndex) ?? 0), 0);
  const upNext = todaysJobs.find((j) => (ACTIONABLE as readonly string[]).includes(j.status)) ?? null;
  const rest = todaysJobs.filter((j) => j.id !== upNext?.id);
  const allDone =
    todaysJobs.length > 0 &&
    !upNext &&
    todaysJobs.every((j) => (TERMINAL as readonly string[]).includes(j.status));

  return (
    <div className="w-full max-w-md mx-auto space-y-6 pb-10">
      {/* Greeting + running total */}
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Aloha, {firstName}</h1>
        {!isLoading && !error && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {todaysJobs.length === 0 ? (
              "Nothing on the schedule today."
            ) : (
              <>
                <span className="font-semibold text-foreground">{fmtMoney(total)}</span> today ·{" "}
                {todaysJobs.length} {todaysJobs.length === 1 ? "clean" : "cleans"}
              </>
            )}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-destructive">
          Couldn't load your day: {error.message}
        </div>
      ) : todaysJobs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Sunrise className="h-9 w-9 mx-auto text-muted-foreground/50" />
          <p className="mt-3 font-medium">No cleans scheduled today</p>
          <p className="text-sm text-muted-foreground mt-1">Enjoy the day off. We'll text you when something's assigned.</p>
        </div>
      ) : (
        <>
          {/* Up next hero card */}
          {upNext ? (
            <UpNextCard job={upNext} payCents={effectivePayCents(upNext, rateIndex)} onOpen={() => setSelectedJob(upNext)} />
          ) : allDone ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
              <CheckCircle2 className="h-9 w-9 mx-auto text-emerald-600" />
              <p className="mt-3 font-semibold">You're all caught up</p>
              <p className="text-sm text-muted-foreground mt-1">
                Every clean for today is done. Mahalo!
              </p>
            </div>
          ) : null}

          {/* Rest of the day */}
          {rest.length > 0 && (
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                {upNext ? "Rest of your day" : "Today's cleans"}
              </div>
              <div className="space-y-2">
                {rest.map((job) => {
                  const meta = STATUS[job.status] ?? STATUS.pending;
                  const money = fmtMoney(effectivePayCents(job, rateIndex));
                  return (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left hover:bg-muted/30 transition"
                    >
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${meta.dot}`} />
                      <div className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                        {fmtTime(job.scheduled_start)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{propName(job)}</div>
                        <div className="text-xs text-muted-foreground truncate">{meta.label}</div>
                      </div>
                      {money && <div className="font-mono text-sm shrink-0">{money}</div>}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <TechnicianJobSheet job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}

function UpNextCard({
  job,
  payCents,
  onOpen,
}: {
  job: CleaningJobWithRelations;
  payCents: number | null;
  onOpen: () => void;
}) {
  const meta = STATUS[job.status] ?? STATUS.pending;
  const money = fmtMoney(payCents);
  const access = job.property?.access_notes ?? "";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        Up next
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-display font-semibold tracking-tight truncate">{propName(job)}</h2>
          <div className="mt-1 text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {fmtRange(job.scheduled_start, job.scheduled_end)}
          </div>
        </div>
        {money && <div className="text-2xl font-bold tabular-nums shrink-0">{money}</div>}
      </div>

      <div className="mt-3">
        <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.pill}`}>
          {meta.label}
        </span>
      </div>

      {access && (
        <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm flex items-start gap-2">
          <KeyRound className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <span className="whitespace-pre-wrap">{access}</span>
        </div>
      )}

      <Button className="mt-4 w-full h-12 text-base" onClick={onOpen}>
        {actionLabel(job.status)}
      </Button>
    </div>
  );
}

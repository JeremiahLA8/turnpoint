import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProblems } from "@/lib/problemsStore";
import { useJobs, useUpdateJob, type CleaningJobWithRelations, type JobStatus } from "@/lib/api/jobs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  MapPin,
  ListChecks,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  XCircle,
  Loader2,
  Hand,
  ShieldCheck,
  CircleDashed,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { TechnicianJobSheet } from "@/components/TechnicianJobSheet";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusMeta: Record<JobStatus, { label: string; tone: string; icon: any }> = {
  pending: { label: "Unassigned", tone: "bg-muted text-muted-foreground", icon: CircleDashed },
  assigned: { label: "Assigned", tone: "bg-secondary text-foreground", icon: Clock },
  acknowledged: { label: "Acknowledged", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-400", icon: Hand },
  in_progress: { label: "In progress", tone: "bg-primary/15 text-primary", icon: PlayCircle },
  completed: { label: "Completed", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  approved: { label: "Approved", tone: "bg-emerald-600/20 text-emerald-700 dark:text-emerald-400", icon: ShieldCheck },
  cancelled: { label: "Cancelled", tone: "bg-muted text-muted-foreground", icon: XCircle },
  // Legacy — backfill should have removed this, but keep a sane label in case any survive.
  scheduled: { label: "Scheduled", tone: "bg-secondary text-foreground", icon: Clock },
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const TechnicianDashboard = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { data: jobs = [], isLoading: jobsLoading, error: jobsError } = useJobs();
  const updateJob = useUpdateJob();

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setFullName(data?.full_name ?? null);
        setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const techFirst = (fullName || user?.email || "there").split(/[\s@]/)[0];
  const today = new Date();
  const greeting =
    today.getHours() < 12 ? "Good morning" : today.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Sort once: chronological. RLS already filters cleaning_jobs to those
  // assigned to this technician.
  const sortedJobs = useMemo(
    () =>
      [...jobs].sort(
        (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
      ),
    [jobs],
  );

  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const weekEnd = useMemo(() => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [todayStart]);

  const todayJobs = useMemo(
    () => sortedJobs.filter((j) => sameDay(new Date(j.scheduled_start), todayStart)),
    [sortedJobs, todayStart],
  );

  const upcomingJobs = useMemo(
    () =>
      sortedJobs
        .filter((j) => {
          const d = new Date(j.scheduled_start);
          return d >= todayStart && d < weekEnd && !sameDay(d, todayStart);
        })
        .slice(0, 6),
    [sortedJobs, todayStart, weekEnd],
  );

  const nextJob = todayJobs[0] ?? upcomingJobs[0];
  const inProgress = sortedJobs.filter((j) => j.status === "in_progress").length;

  const allProblems = useProblems();
  const myProblems = useMemo(
    () => (fullName ? allProblems.filter((p) => p.reporter === fullName) : []),
    [fullName, allProblems],
  );
  const openProblems = myProblems.filter((p) => p.status === "unresolved");

  const selectedJob = useMemo(
    () => (selectedJobId ? sortedJobs.find((j) => j.id === selectedJobId) ?? null : null),
    [sortedJobs, selectedJobId],
  );

  const updateJobStatus = async (job: CleaningJobWithRelations, next: JobStatus) => {
    const patch: Parameters<typeof updateJob.mutateAsync>[0]["patch"] = { status: next };
    if (next === "in_progress") patch.started_at = new Date().toISOString();
    else if (next === "completed") patch.completed_at = new Date().toISOString();
    try {
      await updateJob.mutateAsync({ id: job.id, patch });
      const labels: Partial<Record<JobStatus, string>> = {
        acknowledged: "acknowledged",
        in_progress: "started",
        completed: "marked complete",
        cancelled: "cancelled",
        assigned: "reopened",
      };
      const propertyName = job.property?.nickname ?? job.property?.name ?? "Job";
      toast.success(`${propertyName} ${labels[next] ?? next}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update job");
    }
  };

  if (profileLoading || jobsLoading) {
    return (
      <div className="space-y-6 w-full max-w-5xl mx-auto pb-10">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto pb-10">
      <header>
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{dateStr}</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
          {greeting}, {techFirst}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Here's what's on your plate today.
        </p>
      </header>

      {jobsError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load jobs: {jobsError.message}
        </div>
      )}

      {/* Personal KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "TODAY", value: todayJobs.length, icon: Calendar },
          { label: "THIS WEEK", value: todayJobs.length + upcomingJobs.length, icon: ListChecks },
          { label: "IN PROGRESS", value: inProgress, icon: PlayCircle },
          { label: "OPEN ISSUES", value: openProblems.length, icon: AlertTriangle, danger: openProblems.length > 0 },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-5 relative overflow-hidden">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 tracking-wider">{k.label}</div>
            <div className={cn("text-4xl font-bold tracking-tight", k.danger && "text-destructive")}>
              {String(k.value).padStart(2, "0")}
            </div>
            <k.icon
              className={cn(
                "absolute top-4 right-4 h-4 w-4",
                k.danger ? "text-destructive/60" : "text-muted-foreground/40",
              )}
            />
          </div>
        ))}
      </section>

      {/* Empty state */}
      {sortedJobs.length === 0 && !jobsError && (
        <section className="bg-card border border-border rounded-xl p-8 text-center">
          <h2 className="text-lg font-bold tracking-tight mb-1">No jobs assigned yet</h2>
          <p className="text-sm text-muted-foreground">
            When a manager assigns you a cleaning, it will show up here. Take a breather.
          </p>
        </section>
      )}

      {/* Next job spotlight */}
      {nextJob && (
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {todayJobs.length > 0 ? "Up next today" : "Your next job"}
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              {dayNames[new Date(nextJob.scheduled_start).getDay()]}
            </Badge>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className={cn("w-14 h-14 rounded-lg flex items-center justify-center shrink-0", nextJob.property?.color ?? "bg-slate-300")}>
              <Calendar className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold tracking-tight truncate">
                {nextJob.property?.nickname ?? nextJob.property?.name ?? "—"}
              </h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(nextJob.scheduled_start)}
                {nextJob.scheduled_end ? ` – ${formatTime(nextJob.scheduled_end)}` : ""}
              </div>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setSelectedJobId(nextJob.id)}>
              Open job <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </section>
      )}

      {/* Today's jobs */}
      {todayJobs.length > 0 && (
        <section className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Today's jobs</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {todayJobs.length} job{todayJobs.length === 1 ? "" : "s"} on the books
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/projects/schedule">View week</Link>
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {todayJobs.map((j) => {
              const meta = statusMeta[j.status];
              const isDone = j.status === "completed" || j.status === "cancelled" || j.status === "approved";
              const propertyName = j.property?.nickname ?? j.property?.name ?? "—";
              const propertyColor = j.property?.color ?? "bg-slate-300";
              return (
                <li key={j.id} className="hover:bg-muted/30">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedJobId(j.id)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left"
                    >
                      <div className={cn("w-10 h-10 rounded-lg shrink-0", propertyColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{propertyName}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatTime(j.scheduled_start)}
                            {j.scheduled_end ? ` – ${formatTime(j.scheduled_end)}` : ""}
                          </span>
                        </div>
                      </div>
                    </button>
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium shrink-0",
                        meta.tone,
                      )}
                    >
                      <meta.icon className="h-3 w-3" /> {meta.label}
                    </div>
                    {!isDone && (
                      <div className="flex items-center gap-2 shrink-0">
                        {j.status === "assigned" && (
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={updateJob.isPending}
                            onClick={() => updateJobStatus(j, "acknowledged")}
                          >
                            {updateJob.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hand className="h-3.5 w-3.5" />}
                            Acknowledge
                          </Button>
                        )}
                        {(j.status === "acknowledged" || j.status === "pending") && (
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={updateJob.isPending}
                            onClick={() => updateJobStatus(j, "in_progress")}
                          >
                            {updateJob.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                            Start
                          </Button>
                        )}
                        {j.status === "in_progress" && (
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={updateJob.isPending}
                            onClick={() => updateJobStatus(j, "completed")}
                          >
                            {updateJob.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={updateJob.isPending}
                          onClick={() => updateJobStatus(j, "cancelled")}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Two column: Upcoming + My reported issues */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold tracking-tight">Upcoming this week</h2>
          </div>
          {upcomingJobs.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No upcoming jobs.</div>
          ) : (
            <ul className="divide-y divide-border">
              {upcomingJobs.map((j) => {
                const propertyName = j.property?.nickname ?? j.property?.name ?? "—";
                const d = new Date(j.scheduled_start);
                return (
                  <li key={j.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedJobId(j.id)}
                      className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                    >
                      <div className="w-10 text-center">
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">
                          {dayNames[d.getDay()]}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{propertyName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" /> {formatTime(j.scheduled_start)}
                          {j.scheduled_end ? ` – ${formatTime(j.scheduled_end)}` : ""}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-bold tracking-tight">Issues you've reported</h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/property-problems">Report new</Link>
            </Button>
          </div>
          {myProblems.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No issues reported. Spotted one? Let the manager know.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {myProblems.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/property-problems/${p.id}`}
                    className="p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        p.status === "unresolved" ? "text-destructive" : "text-muted-foreground",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{p.property}</div>
                    </div>
                    <Badge variant={p.status === "unresolved" ? "destructive" : "outline"} className="text-[10px]">
                      {p.status === "unresolved" ? "Open" : "Solved"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "My schedule", to: "/projects/schedule", icon: Calendar },
          { label: "Checklists", to: "/checklists", icon: ListChecks },
          { label: "Report a problem", to: "/property-problems", icon: AlertTriangle },
        ].map((a) => (
          <Button key={a.to} asChild variant="outline" className="h-auto py-4 justify-start gap-3">
            <Link to={a.to}>
              <a.icon className="h-4 w-4" />
              <span className="font-medium">{a.label}</span>
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Link>
          </Button>
        ))}
      </section>

      <TechnicianJobSheet job={selectedJob} onClose={() => setSelectedJobId(null)} />
    </div>
  );
};

export default TechnicianDashboard;

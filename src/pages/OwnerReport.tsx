// Turnpoint — Owner report (per-property, print/share).
//
// An MVP-cut-line deliverable: a clean, printable summary a manager hands the
// owner. Pick a property + date range -> every completed/approved turn in that
// window, with before/after photos and any issue the cleaner flagged. "Print"
// uses the browser's print-to-PDF (see the @media print block in index.css,
// which isolates .print-area and hides .no-print chrome). No new deps.
//
// There's no owner entity in the schema yet, so this is per-property; the
// manager sends it to whoever owns that property. Crew pay is deliberately
// omitted — that's internal, not for the owner.

import { useEffect, useMemo, useState } from "react";
import { useProperties } from "@/lib/api/properties";
import { useJobs, type CleaningJobWithRelations } from "@/lib/api/jobs";
import { JobPhotosViewer } from "@/components/JobPhotosViewer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, AlertTriangle, CalendarRange, MapPin } from "lucide-react";

type Period = "this_month" | "last_month" | "last_90" | "all";

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

function rangeFor(period: Period, today: Date): { from: Date; to: Date; label: string } {
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  if (period === "last_90") {
    return { from: addDays(startOfDay(today), -89), to: end, label: "Last 90 days" };
  }
  if (period === "all") {
    return { from: new Date(0), to: end, label: "All time" };
  }
  if (period === "last_month") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
    return { from, to, label: from.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
  }
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from, to: end, label: from.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_90", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

const turnDate = (j: CleaningJobWithRelations) => new Date(j.completed_at ?? j.scheduled_start);
const longDate = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

export default function OwnerReport() {
  const { data: properties, isLoading: propsLoading } = useProperties();
  const { data: jobs, isLoading: jobsLoading, error } = useJobs();
  const [propertyId, setPropertyId] = useState("");
  const [period, setPeriod] = useState<Period>("this_month");

  // Default to the first property once they load.
  useEffect(() => {
    if (!propertyId && properties && properties.length > 0) setPropertyId(properties[0].id);
  }, [properties, propertyId]);

  const today = useMemo(() => new Date(), []);
  const generatedOn = useMemo(() => longDate(today), [today]);
  const { from, to, label } = useMemo(() => rangeFor(period, today), [period, today]);

  const property = properties?.find((p) => p.id === propertyId) ?? null;

  const turns = useMemo(() => {
    return (jobs ?? [])
      .filter((j) => j.property_id === propertyId)
      .filter((j) => j.status === "completed" || j.status === "approved")
      .filter((j) => {
        const d = turnDate(j);
        return d >= from && d <= to;
      })
      .sort((a, b) => turnDate(b).getTime() - turnDate(a).getTime());
  }, [jobs, propertyId, from, to]);

  const issueCount = turns.filter((t) => t.issue_flagged).length;
  const isLoading = propsLoading || jobsLoading;

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      {/* Controls — hidden when printing */}
      <div className="no-print flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Property</div>
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose a property" /></SelectTrigger>
            <SelectContent>
              {(properties ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nickname ?? p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Period</div>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`h-10 px-3 text-sm border-r border-border last:border-r-0 transition ${period === p.key ? "bg-foreground text-background" : "hover:bg-muted"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={() => window.print()} disabled={!property || turns.length === 0} className="gap-2 shrink-0">
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      {/* Report */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-destructive">
          Failed to load report: {error.message}
        </div>
      ) : !property ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Pick a property to build its report.
        </div>
      ) : (
        <div className="print-area space-y-5">
          {/* Header */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Cleaning report</div>
                <h1 className="text-3xl font-display font-semibold tracking-tight mt-1">{property.nickname ?? property.name}</h1>
                <div className="mt-1 text-sm text-muted-foreground inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {property.address}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-xl font-semibold tracking-tight">Turnpoint</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Generated {generatedOn}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CalendarRange className="h-4 w-4" /> {label}
              </span>
              <span><span className="font-semibold">{turns.length}</span> {turns.length === 1 ? "turn" : "turns"} completed</span>
              {issueCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> {issueCount} {issueCount === 1 ? "issue" : "issues"} flagged
                </span>
              ) : (
                <span className="text-emerald-700">No issues flagged</span>
              )}
            </div>
          </div>

          {/* Turns */}
          {turns.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <CalendarRange className="h-9 w-9 mx-auto text-muted-foreground/40" />
              <p className="mt-3 font-medium">No completed turns in {label}</p>
              <p className="text-sm text-muted-foreground mt-1">Pick a wider period, or check back once cleans are marked complete.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {turns.map((t) => (
                <TurnCard key={t.id} job={t} />
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center pt-2">
            Prepared by Turnpoint for the property owner. Photos captured by the cleaning crew at the time of service.
          </p>
        </div>
      )}
    </div>
  );
}

function TurnCard({ job }: { job: CleaningJobWithRelations }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 break-inside-avoid">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{longDate(turnDate(job))}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Cleaned by {job.cleaner?.full_name ?? "crew"}
            {job.status === "approved" && " · approved"}
          </div>
        </div>
        {job.issue_flagged && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> Issue flagged
          </span>
        )}
      </div>

      {job.issue_flagged && job.issue_note && (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <div className="font-medium text-amber-700">What the crew reported</div>
          <p className="mt-1 whitespace-pre-wrap">{job.issue_note}</p>
        </div>
      )}

      <div className="mt-4">
        <JobPhotosViewer jobId={job.id} />
      </div>
    </div>
  );
}

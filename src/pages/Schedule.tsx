import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronLeft, ChevronRight, Filter, Loader2, Plus, ShieldCheck, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  useJobs,
  useUpdateJob,
  useCreateJob,
  useApproveJob,
  useUnapproveJob,
  type CleaningJobWithRelations,
  type JobStatus,
} from "@/lib/api/jobs";
import { useProperties } from "@/lib/api/properties";
import { useCleaners } from "@/lib/api/cleaners";
import { TechnicianJobSheet } from "@/components/TechnicianJobSheet";
import { JobPhotosViewer } from "@/components/JobPhotosViewer";
import { PhotoQualityCheck } from "@/components/PhotoQualityCheck";
import { useChecklistProgress } from "@/components/ChecklistDisplay";
import { JobStatusHistory } from "@/components/JobStatusHistory";

// ============================================================================
// Constants
// ============================================================================

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOUR_START = 8;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const TOTAL_HOURS = HOUR_END - HOUR_START;

const statusStyles: Record<JobStatus, { label: string; dot: string; ring: string; text: string }> = {
  pending:      { label: "Pending",      dot: "bg-slate-400",   ring: "ring-slate-400/30",   text: "text-slate-700 dark:text-slate-400" },
  assigned:     { label: "Assigned",     dot: "bg-sky-500",     ring: "ring-sky-500/30",     text: "text-sky-700 dark:text-sky-400" },
  acknowledged: { label: "Acknowledged", dot: "bg-blue-500",    ring: "ring-blue-500/30",    text: "text-blue-700 dark:text-blue-400" },
  in_progress:  { label: "In progress",  dot: "bg-amber-500",   ring: "ring-amber-500/40",   text: "text-amber-700 dark:text-amber-400" },
  completed:    { label: "Completed",    dot: "bg-emerald-500", ring: "ring-emerald-500/30", text: "text-emerald-700 dark:text-emerald-400" },
  approved:     { label: "Approved",     dot: "bg-emerald-700", ring: "ring-emerald-700/40", text: "text-emerald-800 dark:text-emerald-300" },
  cancelled:    { label: "Cancelled",    dot: "bg-rose-500",    ring: "ring-rose-500/30",    text: "text-rose-700 dark:text-rose-400" },
  // Legacy — backfilled but kept in the enum.
  scheduled:    { label: "Scheduled",    dot: "bg-sky-500",     ring: "ring-sky-500/30",     text: "text-sky-700 dark:text-sky-400" },
};

// ============================================================================
// Date / time helpers (all in local timezone)
// ============================================================================

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const sundayOf = (d: Date) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; };

const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60;

const formatHour = (h: number): string => {
  const total = Math.round(h * 4) / 4; // snap to 15-min
  let hr = Math.floor(total);
  let min = Math.round((total - hr) * 60);
  if (min === 60) { hr += 1; min = 0; }
  const period = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${min.toString().padStart(2, "0")} ${period}`;
};

const to24 = (h: number): string => {
  const hr = Math.floor(h);
  const min = Math.round((h - hr) * 60);
  return `${hr.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
};

const from24 = (t: string): number => {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
};

const combineDateAndHour = (date: Date, hour: number): Date => {
  const d = new Date(date);
  const hr = Math.floor(hour);
  const min = Math.round((hour - hr) * 60);
  d.setHours(hr, min, 0, 0);
  return d;
};

const fmtMoney = (cents: number | null) =>
  cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;

const parseAmount = (s: string): number | null => {
  const clean = s.replace(/[^0-9.]/g, "");
  if (!clean) return null;
  const v = Math.round(parseFloat(clean) * 100);
  return Number.isFinite(v) ? v : null;
};

// ============================================================================
// Display types — Schedule renders these, not raw Supabase rows
// ============================================================================

type DisplayJob = {
  id: string;
  date: Date;
  scheduledStart: Date;
  scheduledEnd: Date | null;
  cleanerName: string;
  cleanerId: string | null;
  propertyId: string;
  propertyName: string;
  propertyColor: string;
  checklistTemplateId: string | null;
  status: JobStatus;
  amountCents: number | null;
  amount: string;
  notes: string;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
};

type DisplayGuest = {
  jobId: string;
  guestName: string;
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
};

function mapJobToDisplay(j: CleaningJobWithRelations): DisplayJob {
  const start = new Date(j.scheduled_start);
  const end = j.scheduled_end ? new Date(j.scheduled_end) : null;
  return {
    id: j.id,
    date: start,
    scheduledStart: start,
    scheduledEnd: end,
    cleanerName: j.cleaner?.full_name ?? "Unassigned",
    cleanerId: j.cleaner_id,
    propertyId: j.property_id,
    propertyName: j.property?.nickname ?? j.property?.name ?? "—",
    propertyColor: j.property?.color ?? "bg-slate-300 text-slate-900",
    checklistTemplateId: j.property?.checklist_template_id ?? null,
    status: j.status,
    amountCents: j.amount_cents,
    amount: fmtMoney(j.amount_cents),
    notes: j.notes ?? "",
    guestName: j.guest_name,
    checkIn: j.check_in,
    checkOut: j.check_out,
  };
}

function jobToGuest(j: DisplayJob): DisplayGuest | null {
  if (!j.guestName || !j.checkIn || !j.checkOut) return null;
  return {
    jobId: j.id,
    guestName: j.guestName,
    propertyId: j.propertyId,
    propertyName: j.propertyName,
    checkIn: j.checkIn,
    checkOut: j.checkOut,
  };
}

// ============================================================================
// Drag-to-reschedule control
// ============================================================================

type DragMode = "move" | "start" | "end" | null;

const TimeWindowDrag = ({
  start, end, color, onChange,
}: {
  start: number; end: number; color: string;
  onChange: (start: number, end: number) => void;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; origStart: number; origEnd: number }>({
    mode: null, startX: 0, origStart: 0, origEnd: 0,
  });

  const pxPerHour = () => {
    const w = trackRef.current?.clientWidth ?? 0;
    return w / TOTAL_HOURS;
  };

  const snap = (h: number) => Math.round(h * 4) / 4;

  const onPointerDown = (mode: Exclude<DragMode, null>) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, origStart: start, origEnd: end };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.mode) return;
    const pph = pxPerHour();
    if (!pph) return;
    const deltaH = (e.clientX - d.startX) / pph;
    let s = d.origStart;
    let en = d.origEnd;
    if (d.mode === "move") {
      const dur = d.origEnd - d.origStart;
      s = Math.min(Math.max(snap(d.origStart + deltaH), HOUR_START), HOUR_END - dur);
      en = s + dur;
    } else if (d.mode === "start") {
      s = Math.min(Math.max(snap(d.origStart + deltaH), HOUR_START), d.origEnd - 0.25);
    } else {
      en = Math.max(Math.min(snap(d.origEnd + deltaH), HOUR_END), d.origStart + 0.25);
    }
    onChange(s, en);
  };

  const onPointerUp = () => { dragRef.current.mode = null; };

  const leftPct = ((Math.max(start, HOUR_START) - HOUR_START) / TOTAL_HOURS) * 100;
  const widthPct = Math.max(((end - start) / TOTAL_HOURS) * 100, 2);

  return (
    <div className="space-y-1.5">
      <Label>Drag to reschedule</Label>
      <div
        ref={trackRef}
        className="relative h-12 rounded-md border border-border bg-muted/30 select-none touch-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {HOURS.map((h, i) => (
          <div key={h} className="absolute top-0 bottom-0 border-l border-border/40"
            style={{ left: `${(i / TOTAL_HOURS) * 100}%` }} />
        ))}
        <div
          className={`${color} absolute top-1 bottom-1 rounded cursor-grab active:cursor-grabbing shadow-sm`}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          onPointerDown={onPointerDown("move")}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-foreground/20 rounded-l"
            onPointerDown={(e) => { e.stopPropagation(); onPointerDown("start")(e); }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-foreground/20 rounded-r"
            onPointerDown={(e) => { e.stopPropagation(); onPointerDown("end")(e); }}
          />
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
        <span>{HOUR_START % 12 || 12}{HOUR_START < 12 ? "a" : "p"}</span>
        <span>{HOUR_END % 12 || 12}{HOUR_END < 12 ? "a" : "p"}</span>
      </div>
    </div>
  );
};

// ============================================================================
// Schedule
// ============================================================================

type FormState = {
  propertyId: string;
  cleanerId: string | null;
  amount: string;
  date: Date;
  startHour: number;
  endHour: number;
  status: JobStatus;
  notes: string;
};

const UNASSIGNED = "__unassigned__";

const Schedule = () => {
  const { roles } = useAuth();
  const isTechOnly = roles.includes("technician") && !roles.includes("admin");
  const { data: jobs = [], isLoading, error } = useJobs();
  const { data: propertiesData = [] } = useProperties();
  const { data: cleaners = [] } = useCleaners();
  const updateJob = useUpdateJob();
  const createJob = useCreateJob();
  const approveJob = useApproveJob();
  const unapproveJob = useUnapproveJob();

  const displayJobs = useMemo(() => jobs.map(mapJobToDisplay), [jobs]);
  const displayGuests = useMemo(
    () => displayJobs.map(jobToGuest).filter((g): g is DisplayGuest => !!g),
    [displayJobs],
  );

  // ---- View + selection state ----
  const [view, setView] = useState<"calendar" | "timeline" | "list">("calendar");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [selectedGuestJobId, setSelectedGuestJobId] = useState<string | null>(null);

  // ---- Filter state ----
  const [filterPropertyIds, setFilterPropertyIds] = useState<string[]>([]);
  const toggleFilterProperty = (id: string) =>
    setFilterPropertyIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  const [filterFrom, setFilterFrom] = useState<Date | undefined>();
  const [filterTo, setFilterTo] = useState<Date | undefined>();
  const activeFilterCount =
    (filterPropertyIds.length > 0 ? 1 : 0) + (filterFrom ? 1 : 0) + (filterTo ? 1 : 0);
  const clearFilters = () => {
    setFilterPropertyIds([]);
    setFilterFrom(undefined);
    setFilterTo(undefined);
  };

  const matchesFilters = (j: DisplayJob) => {
    if (filterPropertyIds.length > 0 && !filterPropertyIds.includes(j.propertyId)) return false;
    if (filterFrom && j.date < startOfDay(filterFrom)) return false;
    if (filterTo) {
      const end = startOfDay(filterTo);
      end.setDate(end.getDate() + 1);
      if (j.date >= end) return false;
    }
    return true;
  };

  const filteredJobs = useMemo(() => displayJobs.filter(matchesFilters), [displayJobs, filterPropertyIds, filterFrom, filterTo]);
  const filteredGuests = useMemo(() => {
    const allowedJobIds = new Set(filteredJobs.map((j) => j.id));
    return displayGuests.filter((g) => allowedJobIds.has(g.jobId));
  }, [displayGuests, filteredJobs]);

  // ---- Calendar / Timeline / List navigation ----
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const TL_COL_PX = 92;
  const TL_NAME_PX = 220;
  const TL_PAGE = 30;
  const [timelineStart, setTimelineStart] = useState<Date>(() => {
    const s = sundayOf(new Date());
    s.setDate(s.getDate() - 14);
    return s;
  });
  const [timelineDays, setTimelineDays] = useState(120);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [visibleStartIdx, setVisibleStartIdx] = useState(14);
  const pendingScrollAdjust = useRef(0);

  const stepUnit = view === "calendar" ? "month" : "week";
  const shift = (dir: 1 | -1) => {
    if (view === "timeline") {
      const sc = timelineScrollRef.current;
      if (sc) sc.scrollBy({ left: dir * 7 * TL_COL_PX, behavior: "smooth" });
      return;
    }
    setAnchor((d) => {
      const n = new Date(d);
      if (stepUnit === "month") n.setMonth(n.getMonth() + dir);
      else n.setDate(n.getDate() + dir * 7);
      return n;
    });
  };

  const jumpTimelineTo = (target: Date) => {
    const newStart = sundayOf(target);
    newStart.setDate(newStart.getDate() - 14);
    setTimelineStart(newStart);
    setTimelineDays(120);
    const offsetDays = Math.round((startOfDay(target).getTime() - newStart.getTime()) / 86400000);
    requestAnimationFrame(() => {
      const sc = timelineScrollRef.current;
      if (sc) sc.scrollLeft = offsetDays * TL_COL_PX;
    });
  };

  const goToday = () => {
    if (view === "timeline") {
      jumpTimelineTo(new Date());
      return;
    }
    setAnchor(new Date());
  };

  const visibleTimelineDate = (() => {
    const d = new Date(timelineStart);
    d.setDate(d.getDate() + visibleStartIdx);
    return d;
  })();

  const headerLabel = view === "timeline"
    ? visibleTimelineDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : stepUnit === "month"
    ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : (() => {
        const ws = new Date(anchor); ws.setDate(ws.getDate() - ws.getDay());
        const we = new Date(ws); we.setDate(we.getDate() + 6);
        const sameMonth = ws.getMonth() === we.getMonth();
        const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, opts);
        return sameMonth
          ? `${fmt(ws, { month: "short" })} ${ws.getDate()}–${we.getDate()}, ${we.getFullYear()}`
          : `${fmt(ws, { month: "short", day: "numeric" })} – ${fmt(we, { month: "short", day: "numeric" })}, ${we.getFullYear()}`;
      })();

  useLayoutEffect(() => {
    if (pendingScrollAdjust.current && timelineScrollRef.current) {
      timelineScrollRef.current.scrollLeft += pendingScrollAdjust.current;
      pendingScrollAdjust.current = 0;
    }
  }, [timelineStart, timelineDays]);

  useEffect(() => {
    if (view !== "timeline") return;
    const sc = timelineScrollRef.current;
    if (!sc) return;
    if (sc.scrollLeft === 0) {
      const today = startOfDay(new Date());
      const offset = Math.round((today.getTime() - timelineStart.getTime()) / 86400000);
      if (offset > 0) sc.scrollLeft = Math.max(0, offset * TL_COL_PX - 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const onTimelineScroll = () => {
    const sc = timelineScrollRef.current;
    if (!sc) return;
    const sl = sc.scrollLeft;
    const idx = Math.max(0, Math.floor(sl / TL_COL_PX));
    setVisibleStartIdx(idx);
    const totalW = timelineDays * TL_COL_PX;
    const viewW = sc.clientWidth;
    if (sl < 5 * TL_COL_PX) {
      pendingScrollAdjust.current += TL_PAGE * TL_COL_PX;
      setTimelineStart((d) => { const n = new Date(d); n.setDate(n.getDate() - TL_PAGE); return n; });
      setTimelineDays((c) => c + TL_PAGE);
    } else if (sl + viewW > totalW - 5 * TL_COL_PX) {
      setTimelineDays((c) => c + TL_PAGE);
    }
  };

  const selectedJob = useMemo(
    () => (selectedJobId ? displayJobs.find((j) => j.id === selectedJobId) ?? null : null),
    [displayJobs, selectedJobId],
  );

  const selectedGuest = useMemo(
    () => (selectedGuestJobId ? displayGuests.find((g) => g.jobId === selectedGuestJobId) ?? null : null),
    [displayGuests, selectedGuestJobId],
  );

  // ---- Open / close handlers ----
  const openItem = (j: DisplayJob) => {
    setSelectedJobId(j.id);
    const end = j.scheduledEnd ?? new Date(j.scheduledStart.getTime() + 4 * 3600 * 1000);
    setForm({
      propertyId: j.propertyId,
      cleanerId: j.cleanerId,
      amount: j.amountCents != null ? (j.amountCents / 100).toFixed(2) : "",
      date: startOfDay(j.scheduledStart),
      startHour: hourOf(j.scheduledStart),
      endHour: hourOf(end),
      status: j.status,
      notes: j.notes,
    });
  };

  const closePanel = () => {
    setSelectedJobId(null);
    setForm(null);
  };

  const handleSave = async () => {
    if (!selectedJob || !form) return;
    try {
      const start = combineDateAndHour(form.date, form.startHour);
      const end = combineDateAndHour(form.date, form.endHour);
      await updateJob.mutateAsync({
        id: selectedJob.id,
        patch: {
          property_id: form.propertyId,
          cleaner_id: form.cleanerId,
          scheduled_start: start.toISOString(),
          scheduled_end: end.toISOString(),
          status: form.status,
          amount_cents: parseAmount(form.amount),
          notes: form.notes || null,
        },
      });
      toast({ title: "Job updated", description: `${form.notes ? "Notes saved · " : ""}${start.toLocaleString()}` });
      closePanel();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const handleAddManual = async () => {
    if (propertiesData.length === 0) {
      toast({
        title: "No properties yet",
        description: "Add a property or run Hostaway sync first.",
        variant: "destructive",
      });
      return;
    }
    const baseDate = new Date();
    const start = combineDateAndHour(baseDate, 11);
    const end = combineDateAndHour(baseDate, 15);
    try {
      const fallbackProp = propertiesData[0];
      const created = await createJob.mutateAsync({
        property_id: fallbackProp.id,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        status: "pending",
      });
      // Open the edit sheet for the new row so user can refine it.
      setSelectedJobId(created.id);
      setForm({
        propertyId: created.property_id,
        cleanerId: null,
        amount: "",
        date: startOfDay(start),
        startHour: 11,
        endHour: 15,
        status: "pending",
        notes: "",
      });
    } catch (e) {
      toast({
        title: "Create failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="w-full max-w-[1400px] mx-auto">
      <div className="bg-card border border-border rounded-3xl shadow-xl shadow-border/30 overflow-hidden">
        <div className="px-6 sm:px-8 pt-6 sm:pt-7 pb-5 flex items-center justify-between flex-wrap gap-3 border-b border-border/60">
          {isTechOnly ? <div /> : (
            <Button
              onClick={handleAddManual}
              disabled={createJob.isPending}
              className="rounded-xl px-5 py-2.5 h-auto font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/30"
            >
              {createJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add manual project
            </Button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                <Filter className="h-4 w-4" /> Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Properties</Label>
                  {filterPropertyIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterPropertyIds([])}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1.5">
                  {propertiesData.map((p) => {
                    const checked = filterPropertyIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={() => toggleFilterProperty(p.id)} />
                        <span className="truncate">{p.nickname ?? p.name}</span>
                      </label>
                    );
                  })}
                  {propertiesData.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">No properties yet.</div>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {filterPropertyIds.length === 0 ? "All properties" : `${filterPropertyIds.length} selected`}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-full justify-start font-normal", !filterFrom && "text-muted-foreground")}>
                        {filterFrom ? format(filterFrom, "MMM d, yyyy") : "Any"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarUI mode="single" selected={filterFrom} onSelect={setFilterFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label>To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-full justify-start font-normal", !filterTo && "text-muted-foreground")}>
                        {filterTo ? format(filterTo, "MMM d, yyyy") : "Any"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarUI mode="single" selected={filterTo} onSelect={setFilterTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs text-muted-foreground">{filteredJobs.length} of {displayJobs.length} jobs</span>
                <Button variant="ghost" size="sm" onClick={clearFilters} disabled={activeFilterCount === 0}>Clear</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="overflow-x-auto overflow-y-hidden">
          <div className="flex items-center justify-between px-6 sm:px-8 py-5 flex-wrap gap-4">
            <div className="flex items-center gap-5">
              <button
                onClick={goToday}
                className="px-4 py-1.5 text-sm font-semibold text-foreground bg-muted hover:bg-muted/70 rounded-lg transition-colors"
              >
                Today
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => shift(-1)}
                  aria-label={`Previous ${stepUnit}`}
                  className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {view === "timeline" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="text-lg sm:text-xl font-bold tracking-tight min-w-[180px] text-center px-2 py-1 rounded-md hover:bg-muted transition-colors"
                        aria-label="Jump to month"
                      >
                        {headerLabel}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <CalendarUI
                        mode="single"
                        selected={visibleTimelineDate}
                        onSelect={(d) => d && jumpTimelineTo(d)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight min-w-[180px] text-center">{headerLabel}</h2>
                )}
                <button
                  onClick={() => shift(1)}
                  aria-label={`Next ${stepUnit}`}
                  className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="inline-flex bg-muted/70 p-1 rounded-xl text-xs">
              {(["calendar", "timeline", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-5 py-2 capitalize text-sm font-semibold rounded-lg transition-all ${
                    view === v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 sm:px-8 pb-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/60">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
            {(Object.keys(statusStyles) as JobStatus[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn(statusStyles[k].dot, "h-2 w-2 rounded-full ring-2", statusStyles[k].ring)} />
                {statusStyles[k].label}
              </span>
            ))}
            {isLoading && (
              <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading jobs…
              </span>
            )}
            {error && (
              <span className="ml-auto text-xs text-destructive">Failed to load: {error.message}</span>
            )}
          </div>

          {view === "calendar" && (
            <CalendarView
              anchor={anchor}
              jobs={filteredJobs}
              guests={filteredGuests}
              onOpenJob={openItem}
              onOpenGuest={(g) => setSelectedGuestJobId(g.jobId)}
            />
          )}

          {view === "timeline" && (
            <TimelineView
              propertiesData={propertiesData}
              filterPropertyIds={filterPropertyIds}
              jobs={filteredJobs}
              guests={filteredGuests}
              timelineStart={timelineStart}
              timelineDays={timelineDays}
              colPx={TL_COL_PX}
              namePx={TL_NAME_PX}
              scrollRef={timelineScrollRef}
              onScroll={onTimelineScroll}
              onOpenJob={openItem}
              onOpenGuest={(g) => setSelectedGuestJobId(g.jobId)}
            />
          )}

          {view === "list" && (
            <ListView jobs={filteredJobs} onOpenJob={openItem} />
          )}
        </div>
      </div>

      {/* Edit sheet */}
      {isTechOnly ? (
        <TechnicianJobSheet
          job={selectedJobId ? jobs.find((j) => j.id === selectedJobId) ?? null : null}
          onClose={closePanel}
        />
      ) : (
        <Sheet open={!!selectedJob} onOpenChange={(o) => !o && closePanel()} modal={false}>
          <SheetContent className="sm:max-w-md flex flex-col" onInteractOutside={(e) => e.preventDefault()}>
            {selectedJob && form && (
              <>
                <SheetHeader>
                  <div className={`${selectedJob.propertyColor} h-1.5 w-12 rounded-full mb-3`} />
                  <SheetTitle>Edit job</SheetTitle>
                  <SheetDescription>
                    {selectedJob.guestName ? `Guest: ${selectedJob.guestName} · ` : ""}
                    {form.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </SheetDescription>
                </SheetHeader>
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSave(); }}
                  className="mt-6 space-y-4 flex-1 overflow-y-auto px-1"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="cleaner">Cleaner</Label>
                    <Select
                      value={form.cleanerId ?? UNASSIGNED}
                      onValueChange={(v) =>
                        setForm({ ...form, cleanerId: v === UNASSIGNED ? null : v })
                      }
                    >
                      <SelectTrigger id="cleaner"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>
                          <span className="text-muted-foreground italic">Unassigned</span>
                        </SelectItem>
                        {cleaners.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.full_name ?? "(no name)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {cleaners.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        No technicians yet. Invite cleaners with the technician role to assign jobs.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="property">Property</Label>
                    <Select value={form.propertyId} onValueChange={(v) => setForm({ ...form, propertyId: v })}>
                      <SelectTrigger id="property"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {propertiesData.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nickname ?? p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Pay</Label>
                    <Input
                      id="amount"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00"
                      maxLength={20}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={ymd(form.date)}
                      onChange={(e) => e.target.value && setForm({ ...form, date: parseYmd(e.target.value) })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="start">Start</Label>
                      <Input
                        id="start"
                        type="time"
                        step={900}
                        value={to24(form.startHour)}
                        onChange={(e) => e.target.value && setForm({ ...form, startHour: from24(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="end">End</Label>
                      <Input
                        id="end"
                        type="time"
                        step={900}
                        value={to24(form.endHour)}
                        onChange={(e) => e.target.value && setForm({ ...form, endHour: from24(e.target.value) })}
                      />
                    </div>
                  </div>

                  <TimeWindowDrag
                    start={form.startHour}
                    end={form.endHour}
                    color={selectedJob.propertyColor}
                    onChange={(s, e) => setForm({ ...form, startHour: s, endHour: e })}
                  />

                  <div className="space-y-1.5">
                    <Label htmlFor="status">Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as JobStatus })}>
                      <SelectTrigger id="status">
                        <SelectValue>
                          <span className="inline-flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${statusStyles[form.status].dot}`} />
                            {statusStyles[form.status].label}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(statusStyles) as JobStatus[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            <span className="inline-flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${statusStyles[k].dot}`} />
                              {statusStyles[k].label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Internal notes</Label>
                    <Textarea
                      id="notes"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 1000) })}
                      placeholder="Visible only to your team…"
                      rows={4}
                      maxLength={1000}
                    />
                    <div className="text-[10px] text-muted-foreground text-right font-mono">
                      {form.notes.length}/1000
                    </div>
                  </div>

                  <ChecklistProgressRow
                    jobId={selectedJob.id}
                    templateId={selectedJob.checklistTemplateId}
                  />

                  <div className="space-y-2">
                    <Label>Cleaner photos</Label>
                    <JobPhotosViewer jobId={selectedJob.id} />
                    <PhotoQualityCheck jobId={selectedJob.id} />
                  </div>

                  {/* Manager approval */}
                  {form.status === "completed" && (
                    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
                      <div className="text-xs">
                        Cleaner marked this job complete. Review the checklist + photos above, then approve to finalize.
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        disabled={approveJob.isPending}
                        onClick={async () => {
                          try {
                            await approveJob.mutateAsync(selectedJob.id);
                            toast({ title: "Job approved" });
                            closePanel();
                          } catch (e) {
                            toast({
                              title: "Approve failed",
                              description: e instanceof Error ? e.message : String(e),
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        {approveJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Approve job
                      </Button>
                    </div>
                  )}
                  {form.status === "approved" && (
                    <div className="rounded-md border border-emerald-700/40 bg-emerald-700/5 p-3 space-y-2">
                      <div className="text-xs inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                        This job is approved and locked. Sending it back unlocks photo + checklist edits for the cleaner.
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={unapproveJob.isPending}
                        onClick={async () => {
                          try {
                            await unapproveJob.mutateAsync(selectedJob.id);
                            toast({ title: "Approval reverted", description: "Job is back in progress." });
                            closePanel();
                          } catch (e) {
                            toast({
                              title: "Revert failed",
                              description: e instanceof Error ? e.message : String(e),
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        {unapproveJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        Un-approve
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Status history</Label>
                    <JobStatusHistory jobId={selectedJob.id} />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={closePanel}>Cancel</Button>
                    <Button type="submit" disabled={updateJob.isPending}>
                      {updateJob.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      {updateJob.isPending ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Guest sheet */}
      <Sheet open={!!selectedGuest} onOpenChange={(o) => !o && setSelectedGuestJobId(null)}>
        <SheetContent className="sm:max-w-md flex flex-col">
          {selectedGuest && (() => {
            const ci = parseYmd(selectedGuest.checkIn);
            const co = parseYmd(selectedGuest.checkOut);
            const nights = Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000));
            const fmt = (d: Date) =>
              d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
            const conflicts = filteredGuests.filter((g) => {
              if (g.jobId === selectedGuest.jobId) return false;
              if (g.propertyId !== selectedGuest.propertyId) return false;
              const gi = parseYmd(g.checkIn).getTime();
              const go = parseYmd(g.checkOut).getTime();
              return ci.getTime() < go && gi < co.getTime();
            });
            const propColor = displayJobs.find((j) => j.propertyId === selectedGuest.propertyId)?.propertyColor ?? "bg-primary";
            // Related cleanings: jobs on the same property within (checkin - 1 day .. checkout + 1 day)
            const relatedJobs = filteredJobs.filter((j) => {
              if (j.propertyId !== selectedGuest.propertyId) return false;
              const jt = j.date.getTime();
              return jt >= ci.getTime() - 86400000 && jt <= co.getTime() + 86400000;
            });
            return (
              <>
                <SheetHeader>
                  <div className={cn(propColor, "h-1.5 w-12 rounded-full mb-3")} />
                  <SheetTitle className="flex items-center gap-2">🛏 {selectedGuest.guestName}</SheetTitle>
                  <SheetDescription>
                    {nights} {nights === 1 ? "night" : "nights"} · {selectedGuest.propertyName}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4 flex-1 overflow-y-auto px-1 text-sm">
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Check-in</div>
                      <div className="font-medium">{fmt(ci)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Check-out</div>
                      <div className="font-medium">{fmt(co)}</div>
                    </div>
                  </div>

                  {conflicts.length > 0 && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        {conflicts.length} booking conflict{conflicts.length === 1 ? "" : "s"}
                      </div>
                      <ul className="space-y-1.5 text-xs">
                        {conflicts.map((c, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="font-medium truncate">{c.guestName}</span>
                            <span className="font-mono text-muted-foreground shrink-0">
                              {fmt(parseYmd(c.checkIn))} → {fmt(parseYmd(c.checkOut))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1.5">
                      Related cleanings
                    </div>
                    {relatedJobs.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">No cleanings linked to this stay.</div>
                    ) : (
                      <ul className="space-y-1.5">
                        {relatedJobs.map((j) => {
                          const st = statusStyles[j.status];
                          return (
                            <li key={j.id}>
                              <button
                                onClick={() => { setSelectedGuestJobId(null); openItem(j); }}
                                className="w-full flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 hover:border-foreground/30 text-left"
                              >
                                <span className={cn(st.dot, "h-1.5 w-1.5 rounded-full ring-2", st.ring)} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold truncate">{j.cleanerName}</div>
                                  <div className="text-[10px] font-mono text-muted-foreground">
                                    {j.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                                    {" · "}
                                    {formatHour(hourOf(j.scheduledStart))}
                                    {j.scheduledEnd ? ` – ${formatHour(hourOf(j.scheduledEnd))}` : ""}
                                  </div>
                                </div>
                                <span className="text-[10px] font-mono">{j.amount}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

// ============================================================================
// Calendar view
// ============================================================================

function CalendarView({
  anchor, jobs, guests, onOpenJob, onOpenGuest,
}: {
  anchor: Date;
  jobs: DisplayJob[];
  guests: DisplayGuest[];
  onOpenJob: (j: DisplayJob) => void;
  onOpenGuest: (g: DisplayGuest) => void;
}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, nextDay), inMonth: false });
    nextDay++;
  }
  const today = new Date();
  const isToday = (d: Date) =>
    today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth() && today.getDate() === d.getDate();

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  type Seg = { guest: DisplayGuest; startCol: number; endCol: number; continuesLeft: boolean; continuesRight: boolean; row: number };
  const buildWeekSegments = (week: typeof cells) => {
    const weekStart = week[0].date;
    const weekEnd = week[6].date;
    const segs: Seg[] = [];
    guests.forEach((g) => {
      const ci = parseYmd(g.checkIn);
      const co = parseYmd(g.checkOut);
      if (co < weekStart || ci > weekEnd) return;
      const segStart = ci < weekStart ? weekStart : ci;
      const segEnd = co > weekEnd ? weekEnd : co;
      const startCol = Math.round((segStart.getTime() - weekStart.getTime()) / 86400000);
      const endCol = Math.round((segEnd.getTime() - weekStart.getTime()) / 86400000);
      segs.push({
        guest: g,
        startCol,
        endCol,
        continuesLeft: ci < weekStart,
        continuesRight: co > weekEnd,
        row: 0,
      });
    });
    const rows: Seg[][] = [];
    segs.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
    segs.forEach((s) => {
      let placed = false;
      for (let r = 0; r < rows.length; r++) {
        if (rows[r].every((x) => x.endCol < s.startCol || x.startCol > s.endCol)) {
          s.row = r;
          rows[r].push(s);
          placed = true;
          break;
        }
      }
      if (!placed) {
        s.row = rows.length;
        rows.push([s]);
      }
    });
    return { segs, rowCount: rows.length };
  };

  return (
    <div className="min-w-[900px] border-t border-border/60">
      <div className="grid grid-cols-7">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-3 text-center border-r border-border/60 last:border-r-0">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{d}</div>
          </div>
        ))}
      </div>
      <div>
        {weeks.map((week, wi) => {
          const { segs, rowCount } = buildWeekSegments(week);
          const HEADER_H = 22;
          const BAR_H = 22;
          const BAR_GAP = 4;
          const guestLanesH = rowCount * (BAR_H + BAR_GAP);
          return (
            <div key={wi} className="relative grid grid-cols-7 border-t border-border/60">
              {week.map((cell, ci) => {
                const dayJobs = cell.inMonth ? jobs.filter((j) => ymd(j.date) === ymd(cell.date)) : [];
                return (
                  <div
                    key={ci}
                    className={`relative border-r border-border/60 last:border-r-0 p-2 min-h-[160px] ${
                      cell.inMonth ? (isToday(cell.date) ? "bg-primary/5" : "bg-card") : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center" style={{ height: HEADER_H }}>
                      <div className={`text-sm ${isToday(cell.date) ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold" : cell.inMonth ? "font-semibold text-foreground" : "text-muted-foreground/50 font-medium"}`}>
                        {cell.date.getDate()}
                      </div>
                    </div>
                    <div style={{ height: guestLanesH }} />
                    <div className="space-y-1.5 mt-2">
                      {dayJobs.map((j) => {
                        const st = statusStyles[j.status];
                        const isCancelled = j.status === "cancelled";
                        const isCompleted = j.status === "completed";
                        return (
                          <button
                            key={j.id}
                            onClick={() => onOpenJob(j)}
                            title={`${st.label} • ${j.cleanerName} • ${j.propertyName}`}
                            className={cn(
                              "group w-full flex rounded-lg overflow-hidden border border-border/70 bg-card shadow-sm hover:shadow-md hover:-translate-y-px transition-all text-left",
                              isCancelled && "opacity-60",
                            )}
                          >
                            <div className={`${j.propertyColor} w-1.5 shrink-0`} />
                            <div className="flex-1 p-2 space-y-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={cn(st.dot, "h-1.5 w-1.5 rounded-full shrink-0 ring-2", st.ring)} />
                                <span className={cn(
                                  "text-[11px] font-bold text-foreground truncate",
                                  isCancelled && "line-through",
                                )}>{j.cleanerName}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate leading-tight">{j.propertyName}</div>
                              <div className="flex items-center justify-between gap-1.5 min-w-0">
                                <span className="text-[10px] font-mono text-muted-foreground/80 truncate">
                                  {formatHour(hourOf(j.scheduledStart))}
                                  {j.scheduledEnd ? ` – ${formatHour(hourOf(j.scheduledEnd))}` : ""}
                                </span>
                                {(isCompleted || j.status === "in_progress") && (
                                  <span className={cn("text-[9px] font-semibold uppercase tracking-wide shrink-0", st.text)}>
                                    {isCompleted ? "Done" : "Now"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {segs.map((s, si) => {
                const leftPct = (s.startCol / 7) * 100;
                const widthPct = ((s.endCol - s.startCol + 1) / 7) * 100;
                const top = 6 + HEADER_H + s.row * (BAR_H + BAR_GAP);
                return (
                  <button
                    key={si}
                    type="button"
                    onClick={() => onOpenGuest(s.guest)}
                    className={`absolute pointer-events-auto bg-muted/80 hover:bg-muted border border-border text-[10px] px-1.5 truncate leading-tight text-left transition-colors ${
                      s.continuesLeft ? "rounded-l-none" : "rounded-l"
                    } ${s.continuesRight ? "rounded-r-none" : "rounded-r"}`}
                    style={{
                      left: `calc(${leftPct}% + 4px)`,
                      width: `calc(${widthPct}% - 8px)`,
                      top: `${top}px`,
                      height: `${BAR_H}px`,
                      lineHeight: `${BAR_H}px`,
                    }}
                    title={`${s.guest.guestName} • ${s.guest.propertyName}`}
                  >
                    <span className="font-medium">{s.continuesLeft ? "← " : "🛏 "}{s.guest.guestName}</span>
                    <span className="opacity-70"> · {s.guest.propertyName}</span>
                    {s.continuesRight && <span> →</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Timeline view
// ============================================================================

function TimelineView({
  propertiesData,
  filterPropertyIds,
  jobs,
  guests,
  timelineStart,
  timelineDays,
  colPx,
  namePx,
  scrollRef,
  onScroll,
  onOpenJob,
  onOpenGuest,
}: {
  propertiesData: ReturnType<typeof useProperties>["data"] extends (infer T)[] | undefined ? T[] : never;
  filterPropertyIds: string[];
  jobs: DisplayJob[];
  guests: DisplayGuest[];
  timelineStart: Date;
  timelineDays: number;
  colPx: number;
  namePx: number;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  onOpenJob: (j: DisplayJob) => void;
  onOpenGuest: (g: DisplayGuest) => void;
}) {
  const ws = new Date(timelineStart);
  const DAY_COUNT = timelineDays;
  const cols = Array.from({ length: DAY_COUNT }, (_, i) => {
    const d = new Date(ws); d.setDate(ws.getDate() + i); return d;
  });
  const wsTime = ws.getTime();
  const weTime = wsTime + DAY_COUNT * 86400000;
  const todayKey = ymd(new Date());

  const propRows = filterPropertyIds.length > 0
    ? (propertiesData ?? []).filter((p) => filterPropertyIds.includes(p.id))
    : (propertiesData ?? []);

  const BOOK_TOP = 6;
  const BOOK_H = 24;
  const BOOK_GAP = 4;
  const BOOK_TO_CLEAN_GAP_BASE = 8;
  const BOOK_TO_CLEAN_GAP_PER_LANE = 4;
  const BOOK_TO_CLEAN_GAP_MAX = 24;
  const CLEAN_AREA_H = 40;
  const ROW_PAD_BOTTOM = 6;

  return (
    <div ref={scrollRef} onScroll={onScroll} className="overflow-auto max-w-full">
      <div style={{ width: namePx + DAY_COUNT * colPx }}>
        {/* Header */}
        <div className="flex sticky top-0 z-20 bg-card border-b border-border">
          <div
            className="shrink-0 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-r border-border bg-card sticky left-0 z-10"
            style={{ width: namePx }}
          >
            Property
          </div>
          {cols.map((d, i) => {
            const isToday = ymd(d) === todayKey;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={i}
                className={cn(
                  "shrink-0 text-center py-2 border-r border-border/60",
                  isWeekend && "bg-muted/30",
                  isToday && "bg-primary/10",
                )}
                style={{ width: colPx }}
              >
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className={cn("text-sm font-bold tabular-nums", isToday && "text-primary")}>
                  {d.getDate()}
                </div>
                <div className="text-[9px] text-muted-foreground/70 font-mono">
                  {d.toLocaleDateString(undefined, { month: "short" })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {propRows.map((prop) => {
          const rowGuests = guests.filter((g) => g.propertyId === prop.id);
          const rowJobs = jobs.filter((j) => j.propertyId === prop.id);

          type Lane = { coIdxClipped: number };
          const visibleGuests = rowGuests
            .map((g) => {
              const ci = parseYmd(g.checkIn).getTime();
              const co = parseYmd(g.checkOut).getTime();
              if (co <= wsTime || ci >= weTime) return null;
              const ciIdx = Math.max(0, (ci - wsTime) / 86400000);
              const coIdx = Math.min(DAY_COUNT, (co - wsTime) / 86400000);
              return { g, ci, co, ciIdx, coIdx };
            })
            .filter((x): x is NonNullable<typeof x> => !!x)
            .sort((a, b) => a.ciIdx - b.ciIdx);
          const lanes: Lane[] = [];
          const guestLane = new Map<typeof visibleGuests[number], number>();
          visibleGuests.forEach((vg) => {
            let laneIdx = lanes.findIndex((l) => l.coIdxClipped <= vg.ciIdx);
            if (laneIdx === -1) {
              lanes.push({ coIdxClipped: vg.coIdx });
              laneIdx = lanes.length - 1;
            } else {
              lanes[laneIdx].coIdxClipped = vg.coIdx;
            }
            guestLane.set(vg, laneIdx);
          });
          const laneCount = Math.max(1, lanes.length);
          const bookingBlockH = laneCount * BOOK_H + (laneCount - 1) * BOOK_GAP;
          const bookToCleanGap = Math.min(
            BOOK_TO_CLEAN_GAP_MAX,
            BOOK_TO_CLEAN_GAP_BASE + (laneCount - 1) * BOOK_TO_CLEAN_GAP_PER_LANE,
          );
          const cleanTop = BOOK_TOP + bookingBlockH + bookToCleanGap;
          const ROW_PX = cleanTop + CLEAN_AREA_H + ROW_PAD_BOTTOM;

          return (
            <div
              key={prop.id}
              className="flex border-b border-border/60 relative hover:bg-muted/20 transition-colors"
              style={{ height: ROW_PX }}
            >
              <Link
                to={`/properties/${prop.id}`}
                className="shrink-0 px-4 py-2 border-r border-border bg-card sticky left-0 z-10 flex items-center gap-2 hover:bg-muted/40 transition-colors"
                style={{ width: namePx }}
              >
                <span className={cn(prop.color, "h-8 w-1.5 rounded-full shrink-0")} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate hover:underline">{prop.nickname ?? prop.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {rowGuests.length} bookings
                  </div>
                </div>
              </Link>

              <div className="relative flex" style={{ width: DAY_COUNT * colPx }}>
                {cols.map((d, i) => {
                  const isToday = ymd(d) === todayKey;
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "shrink-0 border-r border-border/40 h-full",
                        isWeekend && "bg-muted/20",
                        isToday && "bg-primary/5",
                      )}
                      style={{ width: colPx }}
                    />
                  );
                })}

                {/* Reservation bars */}
                {visibleGuests.map((vg, gi) => {
                  const { g, ci, co, ciIdx, coIdx } = vg;
                  const startsBefore = ci < wsTime;
                  const endsAfter = co > weTime;
                  const rawLeft = startsBefore ? 0 : (ciIdx + 0.5) * colPx;
                  const rawRight = endsAfter ? DAY_COUNT * colPx : (coIdx + 0.5) * colPx;
                  const left = Math.max(0, rawLeft);
                  const right = Math.min(DAY_COUNT * colPx, rawRight);
                  const width = Math.max(right - left, 24);
                  const leftPx = Math.round(left);
                  const widthPx = Math.round(width);
                  const lane = guestLane.get(vg) ?? 0;
                  const top = BOOK_TOP + lane * (BOOK_H + BOOK_GAP);
                  const nights = Math.max(1, Math.round((co - ci) / 86400000));
                  const fmtMd = (d: Date) =>
                    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  const dateLabel = `${fmtMd(parseYmd(g.checkIn))} – ${fmtMd(parseYmd(g.checkOut))}`;
                  return (
                    <button
                      key={gi}
                      onClick={() => onOpenGuest(g)}
                      className={cn(
                        prop.color,
                        "absolute px-2 text-left flex items-center gap-1.5 opacity-80 hover:opacity-100 hover:shadow-sm transition-all border-l-[3px] border-foreground/40",
                        startsBefore ? "rounded-l-none" : "rounded-r-sm rounded-l-none",
                        endsAfter ? "rounded-r-none" : "rounded-r-sm",
                      )}
                      style={{ left: leftPx, width: widthPx, top, height: BOOK_H }}
                      title={`Guest: ${g.guestName} • ${g.checkIn} → ${g.checkOut} • ${nights} night${nights === 1 ? "" : "s"}`}
                    >
                      {startsBefore && <span className="text-[10px] font-bold opacity-70 shrink-0">←</span>}
                      <span className="text-[10px] font-semibold truncate">{g.guestName}</span>
                      {widthPx > 110 && (
                        <span className="text-[9px] font-mono opacity-70 truncate ml-auto shrink-0">{dateLabel}</span>
                      )}
                      {endsAfter && <span className="text-[10px] font-bold opacity-70 shrink-0">→</span>}
                    </button>
                  );
                })}

                {/* Cleaning chips — positioned at the actual job date */}
                {cols.map((d, i) => {
                  const dayKey = ymd(d);
                  const dayJobs = rowJobs.filter((j) => ymd(j.date) === dayKey);
                  if (dayJobs.length === 0) return null;
                  return (
                    <div
                      key={`j-${i}`}
                      className="absolute flex flex-col gap-1 px-1 overflow-hidden"
                      style={{ left: i * colPx, width: colPx, top: cleanTop, height: CLEAN_AREA_H }}
                    >
                      {dayJobs.slice(0, 2).map((j) => {
                        const st = statusStyles[j.status];
                        return (
                          <button
                            key={j.id}
                            onClick={() => onOpenJob(j)}
                            className={cn(
                              "flex-1 min-w-0 flex flex-col justify-center rounded-md px-1.5 py-1 bg-card border-2 shadow-sm hover:shadow-md hover:-translate-y-px transition-all text-left",
                              st.ring.replace("ring-", "border-"),
                              j.status === "cancelled" && "opacity-60",
                            )}
                            title={`${st.label} • ${j.cleanerName} • ${formatHour(hourOf(j.scheduledStart))} • ${j.amount}`}
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              <span className={cn(st.dot, "h-1.5 w-1.5 rounded-full shrink-0")} />
                              <span className={cn("text-[10px] font-bold truncate text-foreground", j.status === "cancelled" && "line-through")}>
                                {j.cleanerName.split(" ")[0]}
                              </span>
                            </div>
                            <div className="text-[9px] font-mono text-muted-foreground truncate leading-tight">
                              {formatHour(hourOf(j.scheduledStart)).replace(":00", "")}
                            </div>
                          </button>
                        );
                      })}
                      {dayJobs.length > 2 && (
                        <span className="text-[9px] text-muted-foreground font-mono self-center">
                          +{dayJobs.length - 2}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {propRows.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No properties. Run Hostaway sync or add one manually.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// List view
// ============================================================================

function ListView({
  jobs,
  onOpenJob,
}: {
  jobs: DisplayJob[];
  onOpenJob: (j: DisplayJob) => void;
}) {
  const sorted = [...jobs].sort((a, b) => a.date.getTime() - b.date.getTime());
  const groups = new Map<string, DisplayJob[]>();
  sorted.forEach((j) => {
    const k = ymd(j.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(j);
  });

  if (sorted.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">No jobs in this window.</div>
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {Array.from(groups.entries()).map(([dateKey, dayJobs]) => {
        const d = parseYmd(dateKey);
        return (
          <div key={dateKey}>
            <div className="px-6 py-2 bg-secondary/30 text-xs font-mono uppercase tracking-wider text-muted-foreground sticky top-0">
              {d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </div>
            {dayJobs.map((j) => {
              const st = statusStyles[j.status];
              const isCancelled = j.status === "cancelled";
              return (
                <button
                  key={j.id}
                  onClick={() => onOpenJob(j)}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-3.5 hover:bg-muted/40 text-left transition-colors",
                    isCancelled && "opacity-60",
                  )}
                >
                  <div className={`${j.propertyColor} h-10 w-1.5 rounded-full shrink-0`} />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(st.dot, "h-1.5 w-1.5 rounded-full shrink-0 ring-2", st.ring)} />
                      <span className={cn("font-semibold truncate", isCancelled && "line-through")}>{j.cleanerName}</span>
                      <span className={cn("text-[10px] font-semibold uppercase tracking-wide shrink-0", st.text)}>{st.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{j.propertyName}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {formatHour(hourOf(j.scheduledStart))}
                      {j.scheduledEnd ? ` – ${formatHour(hourOf(j.scheduledEnd))}` : ""}
                      {j.guestName ? ` · 🛏 ${j.guestName}` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-mono font-semibold">{j.amount}</div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ChecklistProgressRow({
  jobId,
  templateId,
}: {
  jobId: string;
  templateId: string | null;
}) {
  const progress = useChecklistProgress(jobId, templateId);
  if (!templateId) {
    return (
      <div className="space-y-1.5">
        <Label>Checklist</Label>
        <p className="text-xs text-muted-foreground">
          No checklist assigned to this property.
        </p>
      </div>
    );
  }
  if (progress.loading || progress.total === 0) {
    return (
      <div className="space-y-1.5">
        <Label>Checklist</Label>
        <p className="text-xs text-muted-foreground">
          {progress.loading ? "Loading…" : "Checklist is empty."}
        </p>
      </div>
    );
  }
  const pct = Math.round(progress.ratio * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="m-0">Checklist</Label>
        <span className="text-xs font-mono text-muted-foreground">
          {progress.done}/{progress.total} · {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default Schedule;

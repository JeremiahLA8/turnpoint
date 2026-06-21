// Turnpoint — Readiness Grid (manager command center).
//
// PriceLabs-style multi-calendar applied to cleaning readiness. Rows = your
// properties (pinned left), columns = days, each cell = that home's readiness
// on that day, color-coded. Scan the whole portfolio's turnover pipeline at a
// glance. Filter by area/search to narrow the board. Click a home to drill
// into its calendar + details.
//
// Same engine underneath (Hostaway-synced jobs); assigning only patches
// cleaner_id and the Phase 7 trigger advances status.

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJobs,
  useUpdateJob,
  useApproveJob,
  jobsQueryKey,
  type CleaningJobWithRelations,
} from "@/lib/api/jobs";
import { useProperties, useUpdateProperty, propertiesQueryKey, type Property, type PropertyUpdate } from "@/lib/api/properties";
import { useCleaners } from "@/lib/api/cleaners";
import { useChecklistTemplates } from "@/lib/api/checklists";
import { areaOf } from "@/lib/area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ChevronLeft, ChevronRight, RefreshCw, Search, KeyRound, User, ExternalLink, Home, Wand2,
  AlertTriangle, Clock, Users, CalendarDays, ChevronDown,
} from "lucide-react";

const UNASSIGN = "__unassign";
const NO_DEFAULT = "__none"; // Radix Select can't use "" as an item value
const DAYS = 90; // ~3 months, continuously horizontally scrollable (PriceLabs default)
const START_BACK = 3; // show a few days of context before today
const COL_W = 68; // px width of a single day column (matches w-[68px])
const DAY_MS = 86_400_000;

type Readiness = "needs_cleaner" | "invited" | "scheduled" | "cleaning" | "review" | "ready" | "cancelled";

const CELL: Record<Readiness, { label: string; glyph: string; cls: string }> = {
  needs_cleaner: { label: "Needs cleaner", glyph: "!", cls: "bg-destructive text-destructive-foreground" },
  invited: { label: "Invited · awaiting accept", glyph: "?", cls: "bg-warning/25 text-foreground border border-dashed border-warning" },
  scheduled: { label: "Scheduled", glyph: "", cls: "bg-warning text-warning-foreground" },
  cleaning: { label: "Cleaning", glyph: "", cls: "bg-primary text-primary-foreground" },
  review: { label: "Ready · review", glyph: "✓", cls: "bg-success/15 text-success border border-success/50" },
  ready: { label: "Ready", glyph: "✓", cls: "bg-success text-success-foreground" },
  cancelled: { label: "Cancelled", glyph: "", cls: "bg-muted text-muted-foreground line-through" },
};

function readinessOf(job: CleaningJobWithRelations): Readiness {
  if (job.status === "cancelled") return "cancelled";
  if (job.status === "approved") return "ready";
  if (job.status === "completed") return "review";
  if (job.status === "in_progress") return "cleaning";
  if (!job.cleaner_id || job.status === "pending") return "needs_cleaner";
  if (job.status === "assigned") return "invited"; // assigned but not yet accepted
  return "scheduled";
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function initials(name: string | null): string {
  if (!name) return "";
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");
}

// Relative day label for the exception band ("today" / "tomorrow" / "Sat Jun 14").
function exDay(iso: string, today: Date): string {
  const d = startOfDay(new Date(iso));
  if (d.getTime() === today.getTime()) return "today";
  if (d.getTime() === addDays(today, 1).getTime()) return "tomorrow";
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
const exTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const propLabel = (j: CleaningJobWithRelations) => j.property?.nickname ?? j.property?.name ?? "Home";

export default function Today() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: jobs, isLoading: jobsLoading, error } = useJobs();
  const { data: properties, isLoading: propsLoading } = useProperties();
  const { data: cleaners } = useCleaners();
  const templatesQuery = useChecklistTemplates();
  const update = useUpdateJob();
  const approve = useApproveJob();

  const [search, setSearch] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [openProperty, setOpenProperty] = useState<Property | null>(null);
  const [daysBack, setDaysBack] = useState(START_BACK);
  const [daysForward, setDaysForward] = useState(DAYS);

  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLTableCellElement>(null);
  const prependWidth = useRef<number | null>(null);
  // Live "what month/year am I looking at" header that tracks horizontal scroll.
  const [viewLabel, setViewLabel] = useState(() =>
    new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }),
  );
  const viewIdxRef = useRef(-1);
  const [todayVisible, setTodayVisible] = useState(true); // is today's column on screen?
  const [pickerOpen, setPickerOpen] = useState(false);
  const pendingScrollRef = useRef<Date | null>(null); // a date the picker asked to jump to

  const isLoading = jobsLoading || propsLoading;
  const today = useMemo(() => startOfDay(new Date()), []);
  const start = useMemo(() => addDays(today, -daysBack), [today, daysBack]);
  const dates = useMemo(
    () => Array.from({ length: daysBack + daysForward }, (_, i) => addDays(start, i)),
    [start, daysBack, daysForward],
  );

  function jumpToToday(smooth = true) {
    const el = todayRef.current;
    const c = scrollRef.current;
    if (el && c) c.scrollTo({ left: Math.max(0, el.offsetLeft - 190), behavior: smooth ? "smooth" : "auto" });
  }

  // Read the month/year of the left-most visible day column so the header
  // always says what you're looking at as you scroll across days. Day columns
  // are COL_W wide and sit after the two pinned left columns.
  function updateViewLabel() {
    const c = scrollRef.current;
    if (!c) return;
    const idx = Math.min(dates.length - 1, Math.max(0, Math.round(c.scrollLeft / COL_W)));
    if (idx !== viewIdxRef.current) {
      viewIdxRef.current = idx;
      const d = dates[idx];
      if (d) setViewLabel(d.toLocaleDateString(undefined, { month: "long", year: "numeric" }));
    }
    // Track whether today's column is in view so the "Today" button can hide
    // itself when you're already looking at today.
    const el = todayRef.current;
    if (el) {
      const visLeft = c.scrollLeft + 320; // width of the two pinned left columns
      const visRight = c.scrollLeft + c.clientWidth;
      setTodayVisible(el.offsetLeft + el.offsetWidth > visLeft && el.offsetLeft < visRight);
    }
  }

  // Jump the board to a specific date the user picked. Extends the rendered
  // window first if the date falls outside it, then scrolls (after re-render).
  function goToDate(target: Date) {
    const t = startOfDay(target);
    pendingScrollRef.current = t;
    const diff = Math.round((t.getTime() - today.getTime()) / DAY_MS);
    if (diff >= 0 && diff + 7 > daysForward) setDaysForward(diff + 7);
    else if (diff < 0 && -diff + 3 > daysBack) setDaysBack(-diff + 3);
    else scrollToPending();
  }
  function scrollToPending() {
    const t = pendingScrollRef.current;
    const c = scrollRef.current;
    if (!t || !c) return;
    const index = Math.round((t.getTime() - start.getTime()) / DAY_MS);
    if (index < 0) return;
    c.scrollTo({ left: index * COL_W, behavior: "smooth" });
    pendingScrollRef.current = null;
    requestAnimationFrame(updateViewLabel);
  }

  // Infinite horizontal scroll: extend the window as the user nears either edge.
  function onScroll() {
    const c = scrollRef.current;
    if (!c) return;
    updateViewLabel();
    const { scrollLeft, scrollWidth, clientWidth } = c;
    if (scrollLeft + clientWidth > scrollWidth - 800 && daysForward < 1095) {
      setDaysForward((f) => f + 30);
    }
    if (scrollLeft < 800 && daysBack < 365) {
      prependWidth.current = scrollWidth;
      setDaysBack((b) => b + 30);
    }
  }
  // When days are prepended on the left, keep the viewport visually stable.
  useLayoutEffect(() => {
    const c = scrollRef.current;
    if (c && prependWidth.current != null) {
      c.scrollLeft += c.scrollWidth - prependWidth.current;
      prependWidth.current = null;
      viewIdxRef.current = -1; // indices shifted by the prepend — force a recompute
      updateViewLabel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysBack]);

  // After the window grows to include a picked date, perform the deferred jump.
  useLayoutEffect(() => {
    if (pendingScrollRef.current) scrollToPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysForward, daysBack]);

  // Anchor the scroll on today once data has rendered.
  useEffect(() => {
    if (!isLoading) { jumpToToday(false); updateViewLabel(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // property_id|dateKey -> turn for that day
  const turnByKey = useMemo(() => {
    const m = new Map<string, CleaningJobWithRelations>();
    for (const j of jobs ?? []) {
      // Cancelled turnovers aren't real work — keep them off the board entirely.
      if (!j.scheduled_start || j.status === "cancelled") continue;
      const key = `${j.property_id}|${dateKey(new Date(j.scheduled_start))}`;
      if (!m.has(key)) m.set(key, j);
    }
    return m;
  }, [jobs]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const p of properties ?? []) {
      const c = areaOf(p);
      if (c) set.add(c);
    }
    return [...set].sort();
  }, [properties]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (properties ?? [])
      .filter((p) => {
        if (area && areaOf(p) !== area) return false;
        if (q) {
          const hay = `${p.name} ${p.nickname ?? ""} ${p.address ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.nickname ?? a.name).localeCompare(b.nickname ?? b.name));
  }, [properties, search, area]);

  const cleanerById = useMemo(
    () => new Map((cleaners ?? []).map((c) => [c.id, c.full_name])),
    [cleaners],
  );
  const openByProperty = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of properties ?? []) {
      let n = 0;
      for (const d of dates) {
        const j = turnByKey.get(`${p.id}|${dateKey(d)}`);
        if (j && readinessOf(j) === "needs_cleaner") n++;
      }
      m.set(p.id, n);
    }
    return m;
  }, [properties, dates, turnByKey]);

  // Group the visible homes by area for PriceLabs-style group headers.
  const grouped = useMemo(() => {
    const map = new Map<string, Property[]>();
    for (const p of rows) {
      const a = areaOf(p) ?? "Other";
      if (!map.has(a)) map.set(a, []);
      map.get(a)!.push(p);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const propertyById = useMemo(
    () => new Map((properties ?? []).map((p) => [p.id, p])),
    [properties],
  );

  // Exception engine — the board surfaces its own problems. Three live signals:
  //   needsSoon    — unassigned turn happening today or tomorrow
  //   runningLate  — a cleaner is assigned but the start time has passed and
  //                  they haven't started (today/yesterday window)
  //   doubleBooked — one cleaner holds 2+ active turns on the same day
  const exceptions = useMemo(() => {
    const now = new Date();
    const tomorrow = addDays(today, 1);
    const soonCutoff = addDays(today, 2);
    const needsSoon: CleaningJobWithRelations[] = [];
    const invitePending: CleaningJobWithRelations[] = [];
    const runningLate: CleaningJobWithRelations[] = [];
    const dayCleaner = new Map<string, CleaningJobWithRelations[]>();
    for (const j of jobs ?? []) {
      if (!j.scheduled_start) continue;
      const d = startOfDay(new Date(j.scheduled_start));
      if (readinessOf(j) === "needs_cleaner" && d >= today && d <= tomorrow) needsSoon.push(j);
      // Invited but not yet accepted, and the turn is coming up soon — nudge the
      // manager so an unanswered invite doesn't silently sit unconfirmed.
      if (j.status === "assigned" && d >= today && d <= soonCutoff) invitePending.push(j);
      if (
        (j.status === "assigned" || j.status === "acknowledged") &&
        new Date(j.scheduled_start) < now &&
        d >= addDays(today, -1)
      ) {
        runningLate.push(j);
      }
      if (j.cleaner_id && j.status !== "cancelled" && d >= today) {
        const key = `${j.cleaner_id}|${dateKey(d)}`;
        const arr = dayCleaner.get(key) ?? [];
        arr.push(j);
        dayCleaner.set(key, arr);
      }
    }
    const byStart = (a: CleaningJobWithRelations, b: CleaningJobWithRelations) =>
      new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
    needsSoon.sort(byStart);
    invitePending.sort(byStart);
    runningLate.sort(byStart);
    const doubleBooked = [...dayCleaner.entries()]
      .filter(([, arr]) => arr.length >= 2)
      .map(([key, arr]) => ({ key, cleanerId: key.split("|")[0], jobs: arr.slice().sort(byStart) }))
      .sort((a, b) => new Date(a.jobs[0].scheduled_start).getTime() - new Date(b.jobs[0].scheduled_start).getTime());
    return {
      needsSoon,
      invitePending,
      runningLate,
      doubleBooked,
      total: needsSoon.length + invitePending.length + runningLate.length + doubleBooked.length,
    };
  }, [jobs, today]);

  function openForJob(job: CleaningJobWithRelations) {
    const p = propertyById.get(job.property_id);
    if (p) setOpenProperty(p);
  }

  function assign(job: CleaningJobWithRelations, value: string) {
    const cleaner_id = value === UNASSIGN ? null : value;
    if ((cleaner_id ?? null) === (job.cleaner_id ?? null)) return;
    update.mutate(
      { id: job.id, patch: { cleaner_id } },
      { onError: (e) => toast({ title: "Couldn't assign cleaner", description: e instanceof Error ? e.message : String(e), variant: "destructive" }) },
    );
  }
  function onApprove(job: CleaningJobWithRelations) {
    approve.mutateAsync(job.id).catch((e: unknown) =>
      toast({ title: "Couldn't approve", description: e instanceof Error ? e.message : String(e), variant: "destructive" }),
    );
  }

  async function onSync() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("hostaway-sync");
      if (error) throw error;
      const p = (data as { properties?: { created: number; updated: number } })?.properties;
      const j = (data as { jobs?: { created: number; updated: number } })?.jobs;
      toast({ title: "Synced from Hostaway", description: `Properties: +${p?.created ?? 0} new, ${p?.updated ?? 0} updated. Jobs: +${j?.created ?? 0} new, ${j?.updated ?? 0} updated.` });
      qc.invalidateQueries({ queryKey: propertiesQueryKey });
      qc.invalidateQueries({ queryKey: jobsQueryKey });
    } catch (e) {
      toast({ title: "Sync failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  // Smart auto-assign: fill every still-unassigned upcoming turn with its
  // property's default cleaner. Only touches turns today-onward that have NO
  // cleaner yet (never overrides a manual choice) and whose property has a
  // default set. Writes straight to the DB grouped by cleaner — one query each
  // — so it doesn't fire a per-turn assignment text on a bulk action; the
  // Phase 7 trigger flips pending → assigned server-side.
  async function onAutoAssign() {
    setAutoAssigning(true);
    try {
      const defaultByProp = new Map((properties ?? []).map((p) => [p.id, p.default_cleaner_id ?? null]));
      const byCleaner = new Map<string, string[]>();
      let noDefault = 0;
      for (const j of jobs ?? []) {
        if (j.status === "cancelled" || j.cleaner_id || !j.scheduled_start) continue;
        if (startOfDay(new Date(j.scheduled_start)) < today) continue; // today onward only
        const def = defaultByProp.get(j.property_id) ?? null;
        if (!def) { noDefault++; continue; }
        const arr = byCleaner.get(def) ?? [];
        arr.push(j.id);
        byCleaner.set(def, arr);
      }
      const total = [...byCleaner.values()].reduce((s, a) => s + a.length, 0);
      if (total === 0) {
        toast({
          title: "Nothing to auto-assign",
          description: noDefault > 0
            ? `${noDefault} upcoming ${noDefault === 1 ? "turn needs" : "turns need"} a default cleaner set on the property first.`
            : "Every upcoming turn already has a cleaner.",
        });
        return;
      }
      for (const [cleaner_id, ids] of byCleaner) {
        const { error: upErr } = await supabase.from("cleaning_jobs").update({ cleaner_id }).in("id", ids);
        if (upErr) throw upErr;
      }
      qc.invalidateQueries({ queryKey: jobsQueryKey });
      toast({
        title: `Auto-assigned ${total} ${total === 1 ? "turn" : "turns"}`,
        description: noDefault > 0
          ? `Sent to each property's default cleaner. ${noDefault} more still need a default set.`
          : "Each went to its property's default cleaner.",
      });
    } catch (e) {
      toast({ title: "Auto-assign failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setAutoAssigning(false);
    }
  }

  const rangeLabel = `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(start, DAYS - 1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <div className="space-y-5 w-full max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-semibold tracking-tight">Readiness</h1>
          <p className="text-sm text-muted-foreground mt-1">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onAutoAssign} disabled={autoAssigning || isLoading} className="h-9">
            <Wand2 className={`h-4 w-4 mr-2 ${autoAssigning ? "animate-pulse" : ""}`} />
            {autoAssigning ? "Assigning…" : "Auto-assign"}
          </Button>
          <Button variant="outline" size="sm" onClick={onSync} disabled={syncing} className="h-9">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync"}
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search homes or areas…" className="h-9 w-56 pl-8" />
        </div>
        {areas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setArea(null)} className={`h-8 px-3 rounded-full text-xs border transition ${area === null ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>All areas</button>
            {areas.map((a) => (
              <button key={a} onClick={() => setArea(a)} className={`h-8 px-3 rounded-full text-xs border transition ${area === a ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>{a}</button>
            ))}
          </div>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} {rows.length === 1 ? "home" : "homes"}</span>
      </div>

      {/* Exception band — the board surfaces its own problems */}
      {!isLoading && !error && exceptions.total > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Needs your attention
            <span className="text-xs font-normal text-muted-foreground">· {exceptions.total} {exceptions.total === 1 ? "item" : "items"}</span>
          </div>

          <div className="space-y-2">
            <ExceptionGroup label="Needs cleaner" dotCls="bg-destructive" count={exceptions.needsSoon.length}>
              {exceptions.needsSoon.slice(0, EX_MAX).map((j) => (
                <ExChip key={j.id} cls={EX_CHIP.red} onClick={() => openForJob(j)} title="Unassigned turn — click to assign" icon={<User className="h-3 w-3" />}>
                  {propLabel(j)} · {exDay(j.scheduled_start, today)}
                </ExChip>
              ))}
              <ExMore n={exceptions.needsSoon.length - EX_MAX} />
            </ExceptionGroup>

            <ExceptionGroup label="Running late" dotCls="bg-amber-500" count={exceptions.runningLate.length}>
              {exceptions.runningLate.slice(0, EX_MAX).map((j) => (
                <ExChip key={j.id} cls={EX_CHIP.amber} onClick={() => openForJob(j)} title={`Assigned to ${j.cleaner?.full_name ?? "a cleaner"} but not started`} icon={<Clock className="h-3 w-3" />}>
                  {propLabel(j)} · was {exTime(j.scheduled_start)}
                </ExChip>
              ))}
              <ExMore n={exceptions.runningLate.length - EX_MAX} />
            </ExceptionGroup>

            <ExceptionGroup label="Awaiting accept" dotCls="bg-sky-500" count={exceptions.invitePending.length}>
              {exceptions.invitePending.slice(0, EX_MAX).map((j) => (
                <ExChip key={j.id} cls={EX_CHIP.sky} onClick={() => openForJob(j)} title={`Invited ${j.cleaner?.full_name ?? "a cleaner"} — waiting on accept`} icon={<Clock className="h-3 w-3" />}>
                  {propLabel(j)} · {j.cleaner?.full_name ?? "cleaner"} · {exDay(j.scheduled_start, today)}
                </ExChip>
              ))}
              <ExMore n={exceptions.invitePending.length - EX_MAX} />
            </ExceptionGroup>

            <ExceptionGroup label="Double-booked" dotCls="bg-orange-500" count={exceptions.doubleBooked.length}>
              {exceptions.doubleBooked.slice(0, EX_MAX).map((d) => (
                <ExChip key={d.key} cls={EX_CHIP.orange} onClick={() => openForJob(d.jobs[0])} title="One cleaner, multiple turns same day" icon={<Users className="h-3 w-3" />}>
                  {cleanerById.get(d.cleanerId) ?? "Cleaner"} · {d.jobs.length} turns {exDay(d.jobs[0].scheduled_start, today)}
                </ExChip>
              ))}
              <ExMore n={exceptions.doubleBooked.length - EX_MAX} />
            </ExceptionGroup>
          </div>

          {exceptions.needsSoon.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Tip: <span className="font-medium">Auto-assign</span> clears unassigned turns that have a default cleaner in one click.
            </p>
          )}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : error ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-destructive">Failed to load the board: {error.message}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Home className="h-9 w-9 mx-auto text-muted-foreground/40" />
          <p className="mt-3 font-medium">No homes match</p>
          <p className="text-sm text-muted-foreground mt-1">Clear the search or area filter, or Sync to pull properties from Hostaway.</p>
        </div>
      ) : (
        <div className="relative">
        {/* Date selector — shows the live month/year you're viewing, and lets
            you pick any date to jump the board to it. */}
        <div className="sticky top-0 z-40 flex items-center gap-2 px-1 pb-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full bg-card/95 backdrop-blur shadow-sm">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="text-sm font-display font-semibold tracking-tight">{viewLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                defaultMonth={dates[Math.max(0, viewIdxRef.current)] ?? today}
                onSelect={(d) => { if (d) { goToDate(d); setPickerOpen(false); } }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {!todayVisible && (
            <Button variant="outline" size="sm" className="h-8 rounded-full bg-card/95 backdrop-blur shadow-sm" onClick={() => goToDate(today)}>
              Today
            </Button>
          )}
        </div>
        <div ref={scrollRef} onScroll={onScroll} className="border border-border rounded-2xl bg-card overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-30 bg-card w-[200px] min-w-[200px] border-b border-border px-4 py-2.5 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">Home</th>
                <th className="sticky left-[200px] z-30 bg-card w-[120px] min-w-[120px] border-b border-r border-border px-3 py-2.5 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">Cleaner</th>
                {dates.map((d) => {
                  const isToday = dateKey(d) === dateKey(today);
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  const isMonthStart = d.getDate() === 1; // first day of a month → divider + label
                  return (
                    <th key={dateKey(d)} ref={isToday ? todayRef : undefined} className={`relative w-[68px] min-w-[68px] px-1 py-2 text-center border-b border-border ${isMonthStart ? "border-l-2 border-l-primary/50" : ""} ${weekend ? "bg-muted/40" : ""} ${isToday ? "bg-primary/10" : ""}`}>
                      <div className={`text-xs font-medium whitespace-nowrap ${isToday ? "text-primary font-bold" : ""}`}>{d.getDate()} {d.toLocaleDateString(undefined, { month: "short" })}</div>
                      <div className={`text-[10px] uppercase ${isToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {grouped.map(([areaName, groupProps]) => (
                <Fragment key={areaName}>
                  <tr>
                    <th colSpan={2} className="sticky left-0 z-20 bg-muted/60 px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide border-b border-border">
                      {areaName} <span className="text-muted-foreground font-normal">· {groupProps.length}</span>
                    </th>
                    <td colSpan={dates.length} className="bg-muted/30 border-b border-border" />
                  </tr>
                  {groupProps.map((p) => {
                    const open = openByProperty.get(p.id) ?? 0;
                    const cleaner = cleanerById.get(p.default_cleaner_id ?? "") ?? null;
                    const sub = [areaOf(p), p.beds != null ? `${p.beds} bd` : null].filter(Boolean).join(" · ");
                    return (
                      <tr key={p.id} className="group">
                        <th className="sticky left-0 z-20 bg-card group-hover:bg-muted w-[200px] min-w-[200px] border-b border-border px-4 py-2 text-left transition-colors">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setOpenProperty(p)} className="font-medium text-sm hover:text-primary truncate max-w-[140px] text-left">{p.nickname ?? p.name}</button>
                            {open > 0 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive shrink-0">{open}</span>}
                          </div>
                          {sub && <div className="text-[10px] text-muted-foreground truncate max-w-[170px]">{sub}</div>}
                        </th>
                        <td className="sticky left-[200px] z-20 bg-card group-hover:bg-muted w-[120px] min-w-[120px] border-b border-r border-border px-3 py-2 text-xs text-muted-foreground truncate transition-colors">{cleaner ?? "—"}</td>
                        {dates.map((d) => {
                          const job = turnByKey.get(`${p.id}|${dateKey(d)}`);
                          const weekend = d.getDay() === 0 || d.getDay() === 6;
                          const isToday = dateKey(d) === dateKey(today);
                          return (
                            <td key={dateKey(d)} className={`w-[68px] min-w-[68px] text-center border-b border-border px-0.5 py-1 group-hover:bg-muted transition-colors ${weekend ? "bg-muted/20" : ""} ${isToday ? "bg-primary/5" : ""}`}>
                              {job ? (() => {
                                const r = readinessOf(job);
                                const meta = CELL[r];
                                const ini = initials(job.cleaner?.full_name ?? null);
                                const label = r === "needs_cleaner" ? "!" : (r === "ready" || r === "review") ? "✓" : (ini || meta.glyph || "•");
                                return (
                                  <button
                                    onClick={() => setOpenProperty(p)}
                                    title={`${p.nickname ?? p.name} · ${d.toLocaleDateString()} · ${meta.label}${job.cleaner?.full_name ? ` · ${job.cleaner.full_name}` : ""}`}
                                    className={`h-8 w-full rounded-md inline-flex items-center justify-center text-[11px] font-bold tracking-wide ${meta.cls}`}
                                  >
                                    {label}
                                  </button>
                                );
                              })() : (
                                <span className="text-muted-foreground/15 text-xs">·</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Legend bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground px-4 py-3 border border-border rounded-xl bg-card">
        <span className="font-mono uppercase text-[10px] tracking-wider mr-1">Legend</span>
        <LegendDot cls="bg-destructive" label="Needs cleaner" />
        <LegendDot cls="bg-warning/20 border border-dashed border-warning" label="Invited · awaiting accept" />
        <LegendDot cls="bg-warning" label="Scheduled" />
        <LegendDot cls="bg-primary" label="Cleaning" />
        <LegendDot cls="bg-success/30 border border-success/50" label="Ready · review" />
        <LegendDot cls="bg-success" label="Ready" />
        <span className="inline-flex items-center gap-1.5"><span className="text-muted-foreground/40">·</span> No turn</span>
        <span className="ml-auto text-[11px]">Cell letters = cleaner initials</span>
      </div>

      <PropertyTurnsSheet
        property={openProperty}
        jobs={jobs ?? []}
        cleaners={cleaners ?? []}
        templateName={(id) => templatesQuery.data?.find((t) => t.id === id)?.name ?? null}
        onAssign={assign}
        onApprove={onApprove}
        approving={approve.isPending}
        onClose={() => setOpenProperty(null)}
      />
    </div>
  );
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${cls}`} /> {label}
    </span>
  );
}

// Exception band helpers — one labeled row per problem type so 30 items stay
// scannable instead of being one undifferentiated wall of pills.
const EX_MAX = 12; // chips shown per group before collapsing to "+N more"
const EX_CHIP = {
  red: "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20",
  amber: "border-amber-500/50 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25",
  sky: "border-sky-500/50 bg-sky-500/15 text-sky-700 hover:bg-sky-500/25",
  orange: "border-orange-500/50 bg-orange-500/15 text-orange-700 hover:bg-orange-500/25",
};

function ExceptionGroup({
  label, dotCls, count, children,
}: { label: string; dotCls: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex items-center gap-1.5 shrink-0 w-[136px] pt-1.5">
        <span className={`h-2 w-2 rounded-full ${dotCls}`} />
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{count}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">{children}</div>
    </div>
  );
}

function ExChip({
  cls, onClick, title, icon, children,
}: { cls: string; onClick: () => void; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} title={title} className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition ${cls}`}>
      {icon} {children}
    </button>
  );
}

function ExMore({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="inline-flex items-center h-7 px-2 text-xs text-muted-foreground">+{n} more</span>;
}

function PropertyTurnsSheet({
  property, jobs, cleaners, templateName, onAssign, onApprove, approving, onClose,
}: {
  property: Property | null;
  jobs: CleaningJobWithRelations[];
  cleaners: { id: string; full_name: string | null }[];
  templateName: (id: string | null) => string | null;
  onAssign: (job: CleaningJobWithRelations, value: string) => void;
  onApprove: (job: CleaningJobWithRelations) => void;
  approving: boolean;
  onClose: () => void;
}) {
  const updateProperty = useUpdateProperty();
  const [region, setRegion] = useState("");
  const [defaultCleaner, setDefaultCleaner] = useState<string>(NO_DEFAULT);
  useEffect(() => {
    setRegion((property as { region?: string | null } | null)?.region ?? "");
    setDefaultCleaner(property?.default_cleaner_id ?? NO_DEFAULT);
  }, [property?.id]);

  if (!property) return null;
  const savedRegion = (property as { region?: string | null }).region ?? "";
  const savedDefault = property.default_cleaner_id ?? NO_DEFAULT;
  const today = startOfDay(new Date());
  const turns = jobs
    .filter((j) => j.property_id === property.id && j.status !== "cancelled" && j.scheduled_start && new Date(j.scheduled_start) >= addDays(today, -1))
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

  return (
    <Sheet open={!!property} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl font-semibold tracking-tight">{property.nickname ?? property.name}</SheetTitle>
          <SheetDescription>{property.address ?? "Upcoming turns and details"}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5 flex-1 overflow-y-auto px-1 pb-4">
          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Checklist" value={templateName(property.checklist_template_id) ?? "None set"} />
            {(property.beds != null || property.baths != null) && (
              <Info label="Layout" value={`${property.beds ?? "?"} bd · ${property.baths ?? "?"} ba`} />
            )}
          </div>

          {/* Default cleaner — drives Hostaway auto-assign on new turns and the board's Auto-assign */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
              <User className="h-3 w-3" /> Default cleaner
            </div>
            <div className="flex gap-2">
              <Select value={defaultCleaner} onValueChange={setDefaultCleaner}>
                <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="None set" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEFAULT}>None</SelectItem>
                  {cleaners.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name ?? "Unnamed"}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0"
                disabled={updateProperty.isPending || defaultCleaner === savedDefault}
                onClick={() => updateProperty.mutate({ id: property.id, patch: { default_cleaner_id: defaultCleaner === NO_DEFAULT ? null : defaultCleaner } })}
              >
                Save
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              New turns synced from Hostaway auto-assign here. Use <span className="font-medium">Auto-assign</span> on the board to backfill existing turns.
            </p>
          </div>
          {property.access_notes && (
            <div className="rounded-lg bg-muted/40 p-3 text-sm flex items-start gap-2">
              <KeyRound className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="whitespace-pre-wrap">{property.access_notes}</span>
            </div>
          )}

          {/* Area / region — drives the board's grouping and area filter */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Area / region</div>
            <div className="flex gap-2">
              <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Eugene" className="h-8" />
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0"
                disabled={updateProperty.isPending || region.trim() === savedRegion}
                onClick={() => updateProperty.mutate({ id: property.id, patch: ({ region: region.trim() || null } as unknown) as PropertyUpdate })}
              >
                Save
              </Button>
            </div>
          </div>

          {/* Upcoming turns (the per-home calendar) */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Upcoming turns</div>
            {turns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming turns scheduled.</p>
            ) : (
              <div className="space-y-2">
                {turns.map((job) => {
                  const r = readinessOf(job);
                  const meta = CELL[r];
                  return (
                    <div key={job.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${meta.cls.split(" ")[0]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{new Date(job.scheduled_start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
                        <div className="text-xs text-muted-foreground">{meta.label}</div>
                      </div>
                      {r === "review" ? (
                        <Button size="sm" className="h-8" onClick={() => onApprove(job)} disabled={approving}>Approve</Button>
                      ) : r === "ready" || r === "cancelled" ? null : (
                        <Select value={job.cleaner_id ?? undefined} onValueChange={(v) => onAssign(job, v)}>
                          <SelectTrigger className="h-8 w-[136px]"><SelectValue placeholder="Assign…" /></SelectTrigger>
                          <SelectContent>
                            {cleaners.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name ?? "Unnamed"}</SelectItem>)}
                            {job.cleaner_id && <SelectItem value={UNASSIGN}>— Unassign —</SelectItem>}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Button asChild variant="outline" className="w-full gap-2">
            <Link to={`/properties/${property.id}`}><ExternalLink className="h-4 w-4" /> Full property details</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm flex items-center gap-1.5 mt-0.5">{icon}{value}</div>
    </div>
  );
}

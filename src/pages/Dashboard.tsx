import { kpis, properties, problems, scheduleItems, inventoryItems, payments, teammates } from "@/data/mockData";
import { ChevronRight, AlertTriangle, LayoutGrid, GripVertical, Eye, Trash2, Plus, Pencil, X, Info, ChevronDown, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Area, AreaChart, ResponsiveContainer, Bar, BarChart, XAxis, YAxis, Tooltip as ReTooltip } from "recharts";

type WidgetId =
  | "projects-volume"
  | "payouts-volume"
  | "completion-rate"
  | "active-cleaners"
  | "inventory-health"
  | "open-problems"
  | "top-properties"
  | "top-cleaners";

type DateRange = "7d" | "30d" | "90d";
type CompareTo = "previous" | "year" | "none";

const STORAGE_KEY = "dashboard.widgets.v2";
const DEFAULT_LAYOUT: { id: WidgetId; enabled: boolean }[] = [
  { id: "projects-volume", enabled: true },
  { id: "payouts-volume", enabled: true },
  { id: "completion-rate", enabled: true },
  { id: "inventory-health", enabled: true },
  { id: "active-cleaners", enabled: true },
  { id: "open-problems", enabled: true },
  { id: "top-properties", enabled: true },
  { id: "top-cleaners", enabled: true },
];

// ============ Mock series generators ============
function buildSeries(seed: number, points: number, base: number, variance: number) {
  let s = seed;
  return Array.from({ length: points }, (_, i) => {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    return { day: i, value: Math.max(0, Math.round(base + (r - 0.4) * variance + Math.sin(i / 2) * variance * 0.2)) };
  });
}

function rangeDays(r: DateRange) {
  return r === "7d" ? 7 : r === "30d" ? 30 : 90;
}
function rangeLabel(r: DateRange) {
  return r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "Last 90 days";
}
function compareLabel(c: CompareTo) {
  return c === "previous" ? "Previous period" : c === "year" ? "Previous year" : "No comparison";
}

// ============ Widget Definitions ============
type WidgetDef = {
  id: WidgetId;
  title: string;
  info: string;
  build: (range: DateRange) => {
    value: string;
    prev: string;
    delta: number; // percent
    series: { day: number; value: number }[];
    prevSeries: { day: number; value: number }[];
    type?: "area" | "bar";
    accent?: string;
    breakdown?: { label: string; value: string; tone?: string }[];
  };
};

const fmtMoney = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const WIDGETS: Record<WidgetId, WidgetDef> = {
  "projects-volume": {
    id: "projects-volume",
    title: "Projects volume",
    info: "Total cleaning and maintenance projects scheduled in the selected window.",
    build: (range) => {
      const days = rangeDays(range);
      const series = buildSeries(11, days, 4, 6);
      const prevSeries = buildSeries(13, days, 3, 5);
      const total = series.reduce((s, p) => s + p.value, 0);
      const prevTotal = prevSeries.reduce((s, p) => s + p.value, 0);
      return {
        value: String(total),
        prev: `${prevTotal} previous period`,
        delta: prevTotal ? ((total - prevTotal) / prevTotal) * 100 : 0,
        series,
        prevSeries,
        type: "area",
      };
    },
  },
  "payouts-volume": {
    id: "payouts-volume",
    title: "Payouts volume",
    info: "Total amount paid out to cleaners over the selected window.",
    build: (range) => {
      const days = rangeDays(range);
      const series = buildSeries(7, days, 220, 200).map((p) => ({ ...p, value: p.value * 1.5 }));
      const prevSeries = buildSeries(9, days, 200, 200).map((p) => ({ ...p, value: p.value * 1.4 }));
      const total = series.reduce((s, p) => s + p.value, 0);
      const prevTotal = prevSeries.reduce((s, p) => s + p.value, 0);
      const breakdown = [
        { label: "Paid", value: fmtMoney(payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0)), tone: "bg-emerald-500" },
        { label: "Pending", value: fmtMoney(payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0)), tone: "bg-amber-500" },
      ];
      return {
        value: fmtMoney(total),
        prev: `${fmtMoney(prevTotal)} previous period`,
        delta: prevTotal ? ((total - prevTotal) / prevTotal) * 100 : 0,
        series,
        prevSeries,
        type: "area",
        breakdown,
      };
    },
  },
  "completion-rate": {
    id: "completion-rate",
    title: "Completion rate",
    info: "Percentage of scheduled jobs marked completed on time.",
    build: (range) => {
      const days = rangeDays(range);
      const series = buildSeries(21, days, 88, 14).map((p) => ({ ...p, value: Math.min(100, p.value) }));
      const prevSeries = buildSeries(22, days, 84, 14).map((p) => ({ ...p, value: Math.min(100, p.value) }));
      const avg = Math.round(series.reduce((s, p) => s + p.value, 0) / series.length);
      const prevAvg = Math.round(prevSeries.reduce((s, p) => s + p.value, 0) / prevSeries.length);
      return {
        value: `${avg}%`,
        prev: `${prevAvg}% previous period`,
        delta: avg - prevAvg,
        series,
        prevSeries,
        type: "area",
      };
    },
  },
  "active-cleaners": {
    id: "active-cleaners",
    title: "Active cleaners",
    info: "Cleaners with at least one job in the selected window.",
    build: (range) => {
      const days = rangeDays(range);
      const series = buildSeries(33, days, 5, 3);
      const prevSeries = buildSeries(35, days, 4, 3);
      const peak = Math.max(...series.map((p) => p.value));
      const prevPeak = Math.max(...prevSeries.map((p) => p.value));
      return {
        value: `${peak}`,
        prev: `${prevPeak} previous period`,
        delta: prevPeak ? ((peak - prevPeak) / prevPeak) * 100 : 0,
        series,
        prevSeries,
        type: "bar",
      };
    },
  },
  "inventory-health": {
    id: "inventory-health",
    title: "Inventory alerts",
    info: "Items at or below their reorder threshold across all properties.",
    build: (range) => {
      const days = rangeDays(range);
      const series = buildSeries(41, days, 6, 4);
      const prevSeries = buildSeries(43, days, 5, 4);
      let low = 0, out = 0;
      inventoryItems.forEach((it) =>
        Object.values(it.perProperty).forEach((l) => {
          if (l.current === 0) out++;
          else if (l.current <= l.reorderAt) low++;
        }),
      );
      const total = low + out;
      const prevTotal = prevSeries.reduce((s, p) => s + p.value, 0) / prevSeries.length;
      return {
        value: String(total),
        prev: `${Math.round(prevTotal)} avg previous period`,
        delta: prevTotal ? ((total - prevTotal) / prevTotal) * 100 : 0,
        series,
        prevSeries,
        type: "bar",
        breakdown: [
          { label: "Low stock", value: String(low), tone: "bg-amber-500" },
          { label: "Out of stock", value: String(out), tone: "bg-destructive" },
        ],
      };
    },
  },
  "open-problems": {
    id: "open-problems",
    title: "Open problems",
    info: "Unresolved issues reported by cleaners or guests.",
    build: (range) => {
      const days = rangeDays(range);
      const series = buildSeries(51, days, 2, 3);
      const prevSeries = buildSeries(53, days, 3, 3);
      const open = problems.filter((p) => p.status === "unresolved").length;
      const prev = problems.length;
      return {
        value: String(open),
        prev: `${prev} previous period`,
        delta: prev ? ((open - prev) / prev) * 100 : 0,
        series,
        prevSeries,
        type: "bar",
      };
    },
  },
  "top-properties": {
    id: "top-properties",
    title: "Top properties by activity",
    info: "Properties with the most projects scheduled in the window.",
    build: (range) => {
      const days = rangeDays(range);
      const series = buildSeries(61, days, 3, 5);
      const prevSeries = buildSeries(63, days, 3, 5);
      const top = [...properties].sort((a, b) => b.completion - a.completion).slice(0, 3);
      return {
        value: `${properties.length}`,
        prev: `${properties.length} active properties`,
        delta: 0,
        series,
        prevSeries,
        type: "area",
        breakdown: top.map((p) => ({ label: p.name.split("·")[0].trim(), value: `${p.completion}%`, tone: p.color.split(" ")[0] })),
      };
    },
  },
  "top-cleaners": {
    id: "top-cleaners",
    title: "Top cleaners",
    info: "Cleaners ranked by recent rating and primary assignments.",
    build: (range) => {
      const days = rangeDays(range);
      const series = buildSeries(71, days, 4, 4);
      const prevSeries = buildSeries(73, days, 4, 4);
      const top = [...teammates].sort((a, b) => b.rating - a.rating).slice(0, 3);
      return {
        value: `${teammates.length}`,
        prev: `${teammates.length} team members`,
        delta: 0,
        series,
        prevSeries,
        type: "area",
        breakdown: top.map((t) => ({ label: t.name, value: t.rating.toFixed(1), tone: "bg-primary" })),
      };
    },
  },
};

const Dashboard = () => {
  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const [range, setRange] = useState<DateRange>("7d");
  const [compare, setCompare] = useState<CompareTo>("previous");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const known = new Set(parsed.map((w: any) => w.id));
          const merged = [...parsed.filter((w: any) => w.id in WIDGETS), ...DEFAULT_LAYOUT.filter((w) => !known.has(w.id))];
          setLayout(merged);
        }
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch {}
  }, [layout]);

  const toggleEnabled = (id: WidgetId) =>
    setLayout((l) => l.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
  const reset = () => setLayout(DEFAULT_LAYOUT);

  const onDragStart = (id: WidgetId) => setDragId(id);
  const onDragOver = (e: React.DragEvent, overId: WidgetId) => {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    setLayout((l) => {
      const next = [...l];
      const from = next.findIndex((w) => w.id === dragId);
      const to = next.findIndex((w) => w.id === overId);
      if (from < 0 || to < 0) return l;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const onDragEnd = () => setDragId(null);

  const visible = layout.filter((w) => w.enabled);
  const hidden = layout.filter((w) => !w.enabled);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6 w-full max-w-7xl mx-auto pb-10">
        <header>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{dateStr}</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">{greeting}, Jordan</h1>
        </header>

        {/* KPI Strip — keep operational counts visible */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.key} className="bg-card border border-border rounded-xl p-5 relative overflow-hidden">
              <div className="text-[10px] font-mono text-muted-foreground mb-2 tracking-wider">{k.label}</div>
              <div className={`text-4xl font-bold tracking-tight ${k.danger ? "text-destructive" : ""}`}>
                {String(k.value).padStart(2, "0")}
              </div>
              {k.danger && <AlertTriangle className="absolute top-4 right-4 h-4 w-4 text-destructive/60" />}
            </div>
          ))}
        </section>

        {/* Stripe-style overview header */}
        <section className="bg-card border border-border rounded-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border-b border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold tracking-tight mr-2">Your overview</h2>
              <FilterPill label="Date range" value={rangeLabel(range)}>
                {(["7d", "30d", "90d"] as DateRange[]).map((r) => (
                  <DropdownMenuItem key={r} onClick={() => setRange(r)}>
                    {r === range && <Check className="h-3.5 w-3.5 mr-2" />}
                    <span className={r === range ? "" : "ml-[22px]"}>{rangeLabel(r)}</span>
                  </DropdownMenuItem>
                ))}
              </FilterPill>
              <FilterPill label="Compare" value={compareLabel(compare)} dismissable onDismiss={() => setCompare("none")}>
                {(["previous", "year", "none"] as CompareTo[]).map((c) => (
                  <DropdownMenuItem key={c} onClick={() => setCompare(c)}>
                    {c === compare && <Check className="h-3.5 w-3.5 mr-2" />}
                    <span className={c === compare ? "" : "ml-[22px]"}>{compareLabel(c)}</span>
                  </DropdownMenuItem>
                ))}
              </FilterPill>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Add a widget</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {hidden.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground">All widgets are visible.</div>
                  )}
                  {hidden.map((w) => (
                    <DropdownMenuItem key={w.id} onClick={() => toggleEnabled(w.id)}>
                      <Plus className="h-3.5 w-3.5 mr-2" /> {WIDGETS[w.id].title}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={reset}>Reset to default</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => setEditing((e) => !e)} className="h-8 gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> {editing ? "Done" : "Edit"}
              </Button>
            </div>
          </div>

          {/* Widget Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-border">
            {visible.map((w) => {
              const def = WIDGETS[w.id];
              const data = def.build(range);
              return (
                <div
                  key={w.id}
                  draggable={editing}
                  onDragStart={() => onDragStart(w.id)}
                  onDragOver={(e) => onDragOver(e, w.id)}
                  onDragEnd={onDragEnd}
                  className={`bg-card p-5 relative ${editing ? "cursor-move ring-1 ring-primary/40 ring-inset" : ""} ${dragId === w.id ? "opacity-50" : ""}`}
                >
                  <WidgetCard
                    def={def}
                    data={data}
                    compare={compare}
                    editing={editing}
                    onHide={() => toggleEnabled(w.id)}
                  />
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="bg-card p-10 text-center md:col-span-2 xl:col-span-3">
                <Eye className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No widgets visible. Use "Add" to bring some back.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
};

const FilterPill = ({
  label,
  value,
  children,
  dismissable,
  onDismiss,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
  dismissable?: boolean;
  onDismiss?: () => void;
}) => (
  <div className="inline-flex items-center bg-secondary rounded-full overflow-hidden text-xs h-8">
    {dismissable && (
      <button onClick={onDismiss} className="pl-2.5 pr-1 text-muted-foreground hover:text-foreground" aria-label={`Clear ${label}`}>
        <X className="h-3 w-3" />
      </button>
    )}
    <span className={`text-muted-foreground ${dismissable ? "pr-1.5" : "pl-3 pr-1.5"}`}>{label}</span>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="pl-2 pr-3 py-1.5 text-primary font-medium inline-flex items-center gap-1 hover:bg-secondary/60 border-l border-border h-full">
          {value} <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">{children}</DropdownMenuContent>
    </DropdownMenu>
  </div>
);

const WidgetCard = ({
  def,
  data,
  compare,
  editing,
  onHide,
}: {
  def: WidgetDef;
  data: ReturnType<WidgetDef["build"]>;
  compare: CompareTo;
  editing: boolean;
  onHide: () => void;
}) => {
  const positive = data.delta >= 0;
  const chartData = data.series.map((p, i) => ({
    day: i,
    current: p.value,
    previous: compare !== "none" ? data.prevSeries[i]?.value ?? null : null,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {editing && <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <h3 className="text-sm font-semibold truncate">{def.title}</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground/60 hover:text-foreground">
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">{def.info}</TooltipContent>
          </Tooltip>
        </div>
        {editing && (
          <button onClick={onHide} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors" title="Remove widget">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div>
        <div className="text-2xl font-bold tracking-tight flex items-baseline gap-2">
          {data.value}
          {compare !== "none" && data.delta !== 0 && (
            <span className={`text-[11px] font-medium ${positive ? "text-emerald-600" : "text-destructive"}`}>
              {positive ? "+" : ""}{data.delta.toFixed(1)}%
            </span>
          )}
        </div>
        {compare !== "none" && (
          <div className="text-xs text-muted-foreground mt-0.5">{data.prev}</div>
        )}
      </div>

      <div className="h-16 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          {data.type === "bar" ? (
            <BarChart data={chartData}>
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <ReTooltip cursor={{ fill: "hsl(var(--secondary))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
              {compare !== "none" && <Bar dataKey="previous" fill="hsl(var(--muted-foreground))" opacity={0.25} radius={[2, 2, 0, 0]} />}
              <Bar dataKey="current" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`g-${def.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <ReTooltip cursor={{ stroke: "hsl(var(--border))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
              {compare !== "none" && (
                <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} fill="none" strokeDasharray="3 3" />
              )}
              <Area type="monotone" dataKey="current" stroke="hsl(var(--primary))" strokeWidth={2} fill={`url(#g-${def.id})`} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {data.breakdown && data.breakdown.length > 0 && (
        <div className="pt-2 border-t border-border space-y-1.5">
          {data.breakdown.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${b.tone ?? "bg-primary"}`} />
              <span className="flex-1 truncate text-muted-foreground">{b.label}</span>
              <span className="font-mono font-medium">{b.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;

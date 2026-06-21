// Turnpoint — Crew rates manager (Pay → Rates sub-tab).
//
// One place to set what every cleaner earns per clean at every property,
// instead of editing property-by-property. Grouped by cleaner; filter by area
// or search to narrow. Rates flow straight into the Pay queue, each cleaner's
// "My day" total, and QuickBooks booking via the read-time resolver in
// src/lib/api/payRates.ts. A blank field = "no rate" (cleaner doesn't work here).

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCleaners } from "@/lib/api/cleaners";
import { useJobs } from "@/lib/api/jobs";
import { useProperties, type Property } from "@/lib/api/properties";
import {
  usePayRates,
  useUpsertPayRate,
  useDeletePayRate,
  rateKey,
  type PropertyCleanerRate,
} from "@/lib/api/payRates";
import { useCleanerDwolla, dwollaByCleaner } from "@/lib/api/payouts";
import { BankSetupDialog, type BankSetupTarget } from "@/components/BankSetupDialog";
import { areaOf } from "@/lib/area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Search, Users, Landmark } from "lucide-react";

const propName = (p: Property) => p.nickname ?? p.name;
const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function CrewRatesManager() {
  const { data: cleaners, isLoading: loadingCleaners, error: cleanersErr } = useCleaners();
  const { data: properties, isLoading: loadingProps, error: propsErr } = useProperties();
  const { data: rates, isLoading: loadingRates, error: ratesErr } = usePayRates();
  const { data: jobs, isLoading: loadingJobs, error: jobsErr } = useJobs();
  const { data: dwolla } = useCleanerDwolla();

  const isLoading = loadingCleaners || loadingProps || loadingRates || loadingJobs;
  const error = cleanersErr || propsErr || ratesErr || jobsErr;

  const ddByCleaner = useMemo(() => dwollaByCleaner(dwolla), [dwolla]);

  const [area, setArea] = useState("all");
  const [cleanerFilter, setCleanerFilter] = useState("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bankTarget, setBankTarget] = useState<BankSetupTarget | null>(null);

  // rateKey(property, cleaner) -> the saved rate row (carries id for delete).
  const rateMap = useMemo(() => {
    const m = new Map<string, PropertyCleanerRate>();
    for (const r of rates ?? []) m.set(rateKey(r.property_id, r.cleaner_id), r);
    return m;
  }, [rates]);

  // Which properties each cleaner is actually on — you can only set a rate where
  // a cleaner works. A cleaner is "on" a property if they're its default cleaner,
  // have a job there, or already have a rate. Associations come from assigning
  // cleaners on the Readiness board, not from this screen.
  const assoc = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (cleanerId: string | null, propId: string | null) => {
      if (!cleanerId || !propId) return;
      let set = m.get(cleanerId);
      if (!set) m.set(cleanerId, (set = new Set()));
      set.add(propId);
    };
    for (const p of properties ?? []) add(p.default_cleaner_id, p.id);
    for (const j of jobs ?? []) add(j.cleaner_id, j.property_id);
    for (const r of rates ?? []) add(r.cleaner_id, r.property_id);
    return m;
  }, [properties, jobs, rates]);

  // Distinct areas for the filter dropdown.
  const areas = useMemo(() => {
    const s = new Set<string>();
    for (const p of properties ?? []) {
      const a = areaOf(p);
      if (a) s.add(a);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [properties]);

  // Properties after area + search filters (shared across every cleaner group).
  const visibleProperties = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (properties ?? []).filter((p) => {
      if (area !== "all" && areaOf(p) !== area) return false;
      if (needle) {
        const hay = `${p.name} ${p.nickname ?? ""} ${p.address}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [properties, area, q]);

  const visibleCleaners = useMemo(() => {
    return (cleaners ?? []).filter((c) => cleanerFilter === "all" || c.id === cleanerFilter);
  }, [cleaners, cleanerFilter]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-destructive">
        Couldn't load rates: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search property…"
            className="pl-8 h-9"
          />
        </div>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Area" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cleanerFilter} onValueChange={setCleanerFilter}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Cleaner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cleaners</SelectItem>
            {(cleaners ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.full_name ?? "Unnamed"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visibleCleaners.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Users className="h-9 w-9 mx-auto text-muted-foreground/40" />
          <p className="mt-3 font-medium">No cleaners</p>
          <p className="text-sm text-muted-foreground mt-1">Add cleaner accounts, then set their rates here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleCleaners.map((c) => {
            const isOpen = expanded.has(c.id);
            const assignedSet = assoc.get(c.id);
            const assignedCount = assignedSet?.size ?? 0;
            // Only the cleaner's own properties, then the active area/search filters.
            const cleanerProps = assignedSet
              ? visibleProperties.filter((p) => assignedSet.has(p.id))
              : [];
            const priced = cleanerProps.filter((p) => rateMap.has(rateKey(p.id, c.id)));
            const avg = priced.length
              ? priced.reduce((s, p) => s + (rateMap.get(rateKey(p.id, c.id))?.amount_cents ?? 0), 0) / priced.length
              : null;
            const dd = ddByCleaner.get(c.id);
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button onClick={() => toggle(c.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.full_name ?? "Unnamed cleaner"}</div>
                    <div className="text-xs text-muted-foreground">
                      {assignedCount === 0 ? (
                        "Not on any properties yet"
                      ) : (
                        <>
                          {priced.length} of {cleanerProps.length} priced
                          {avg != null && <span> · avg {fmtMoney(avg)}</span>}
                        </>
                      )}
                      {dd?.bank_last4 && <span className="text-emerald-600"> · direct deposit ••{dd.bank_last4}</span>}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {/* Direct deposit setup */}
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/20">
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                        <Landmark className="h-3.5 w-3.5" />
                        {dd?.bank_last4 ? `Direct deposit ••${dd.bank_last4}` : "No direct deposit set up"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBankTarget({ cleanerId: c.id, cleanerName: c.full_name ?? "cleaner", currentLast4: dd?.bank_last4 })}
                      >
                        {dd?.bank_last4 ? "Change bank" : "Set up direct deposit"}
                      </Button>
                    </div>
                    {assignedCount === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground">
                        Not assigned to any properties yet. Assign this cleaner on the Readiness board (or set them as a property's default cleaner) to set their rate here.
                      </div>
                    ) : cleanerProps.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground">None of this cleaner's properties match the filters.</div>
                    ) : (
                      cleanerProps.map((p) => (
                        <RateRow
                          key={p.id}
                          label={propName(p)}
                          area={areaOf(p)}
                          propertyId={p.id}
                          cleanerId={c.id}
                          cleanerName={c.full_name}
                          rate={rateMap.get(rateKey(p.id, c.id))}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BankSetupDialog target={bankTarget} onClose={() => setBankTarget(null)} />
    </div>
  );
}

function RateRow({
  label,
  area,
  propertyId,
  cleanerId,
  cleanerName,
  rate,
}: {
  label: string;
  area: string | null;
  propertyId: string;
  cleanerId: string;
  cleanerName: string | null;
  rate: PropertyCleanerRate | undefined;
}) {
  const saved = rate ? String(rate.amount_cents / 100) : "";
  const [value, setValue] = useState(saved);
  const upsert = useUpsertPayRate();
  const del = useDeletePayRate();

  // Re-sync if the saved rate changes elsewhere; mid-typing this is a no-op
  // because `saved` only moves once a write lands. Keyed by the row identity.
  const [lastSaved, setLastSaved] = useState(saved);
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setValue(saved);
  }

  const trimmed = value.trim();
  const parsed = trimmed === "" ? null : Number(trimmed);
  const invalid = parsed != null && (!isFinite(parsed) || parsed < 0);
  const dirty = trimmed !== saved.trim();
  const pending = upsert.isPending || del.isPending;

  async function save() {
    if (invalid || !dirty) return;
    try {
      if (parsed == null) {
        if (rate) await del.mutateAsync(rate.id);
      } else {
        await upsert.mutateAsync({
          property_id: propertyId,
          cleaner_id: cleanerId,
          amount_cents: Math.round(parsed * 100),
        });
      }
      toast.success(`Saved ${cleanerName ?? "cleaner"}'s rate for ${label}`);
    } catch (e) {
      toast.error(`Couldn't save: ${(e as Error).message}`);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{label}</div>
        {area && <div className="text-[11px] text-muted-foreground">{area}</div>}
      </div>
      <div className="relative w-28 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          inputMode="decimal"
          placeholder="—"
          aria-label={`${cleanerName ?? "Cleaner"} rate at ${label}`}
          aria-invalid={invalid}
          className={`pl-6 font-mono text-right h-9 ${invalid ? "border-destructive" : ""}`}
        />
      </div>
      <Button
        size="sm"
        variant={dirty && !invalid ? "default" : "outline"}
        disabled={!dirty || invalid || pending}
        onClick={save}
        className="shrink-0 w-16"
      >
        {pending ? "…" : "Save"}
      </Button>
    </div>
  );
}

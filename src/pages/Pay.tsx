// Turnpoint — Crew Pay (Phase 1 payments hub).
//
// Two jobs on one screen:
//   1. "To pay now" — every approved clean (with a rate) you haven't
//      paid yet, grouped by cleaner. You pay them your usual way, hit "Mark
//      paid", and it lands in the cleaner_payouts ledger. Rail-agnostic: today
//      it's a manual record; a future rail (QuickBooks Contractor Payments,
//      Dwolla, Stripe) writes the same rows. No marketplace cut, ever.
//   2. Earnings by period — what each cleaner earned, with paid vs owed tags.

import { useMemo, useState } from "react";
import { useJobs, type CleaningJobWithRelations } from "@/lib/api/jobs";
import { usePayRates, buildRateIndex, effectivePayCents } from "@/lib/api/payRates";
import {
  usePayouts,
  useBookPayouts,
  unbookedPayouts,
  failedAchPayouts,
  buildPaidByJob,
  PAYOUT_METHOD_LABEL,
} from "@/lib/api/payouts";
import { RecordPayoutDialog, type PayoutTarget, type PayoutJob } from "@/components/RecordPayoutDialog";
import { CrewRatesManager } from "@/components/CrewRatesManager";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ChevronDown, Wallet, AlertTriangle, CheckCircle2, BookCheck } from "lucide-react";

type Period = "this_month" | "last_month" | "last_7";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const propLabel = (j: CleaningJobWithRelations) => j.property?.nickname ?? j.property?.name ?? "Property";
const jobDate = (j: CleaningJobWithRelations) => j.completed_at ?? j.scheduled_start;

function rangeFor(period: Period, today: Date): { from: Date; to: Date; label: string } {
  const end = new Date(today); end.setHours(23, 59, 59, 999);
  if (period === "last_7") {
    return { from: addDays(startOfDay(today), -6), to: end, label: "Last 7 days" };
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
  { key: "last_7", label: "Last 7 days" },
];

export default function Pay() {
  const { data: jobs, isLoading: jobsLoading, error } = useJobs();
  const { data: rates, isLoading: ratesLoading } = usePayRates();
  const { data: payouts, isLoading: payoutsLoading } = usePayouts();
  const book = useBookPayouts();

  const [period, setPeriod] = useState<Period>("this_month");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [payTarget, setPayTarget] = useState<PayoutTarget | null>(null);

  const unbooked = useMemo(() => unbookedPayouts(payouts), [payouts]);
  const failedAch = useMemo(() => failedAchPayouts(payouts), [payouts]);

  async function bookUnbooked() {
    if (unbooked.length === 0) return;
    try {
      const results = await book.mutateAsync(unbooked.map((p) => p.id));
      const booked = results.filter((r) => r.status === "booked").length;
      const failed = results.filter((r) => r.status === "error").length;
      if (failed > 0) {
        toast.warning(`Booked ${booked}; ${failed} still failed. Check QuickBooks setup.`);
      } else {
        toast.success(`Booked ${booked} ${booked === 1 ? "payout" : "payouts"} to QuickBooks`);
      }
    } catch (e) {
      toast.error(`Couldn't book to QuickBooks: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  const isLoading = jobsLoading || ratesLoading || payoutsLoading;
  const today = useMemo(() => new Date(), []);
  const { from, to, label } = useMemo(() => rangeFor(period, today), [period, today]);

  const rateIndex = useMemo(() => buildRateIndex(rates), [rates]);
  const paidByJob = useMemo(() => buildPaidByJob(payouts), [payouts]);

  // "To pay now" — all-time outstanding: approved + has rate + unpaid.
  const { queue, queueTotal, queueCount, blockedNoRate } = useMemo(() => {
    const m = new Map<string, { name: string; jobs: PayoutJob[]; total: number }>();
    let noRate = 0;
    for (const j of jobs ?? []) {
      if (j.status !== "approved" || !j.cleaner_id || paidByJob.has(j.id)) continue;
      const pay = effectivePayCents(j, rateIndex);
      if (pay == null) { noRate++; continue; }
      const cur = m.get(j.cleaner_id) ?? { name: j.cleaner?.full_name ?? "Cleaner", jobs: [], total: 0 };
      cur.jobs.push({
        id: j.id,
        propertyId: j.property_id,
        propertyLabel: propLabel(j),
        amountCents: pay,
        date: jobDate(j),
      });
      cur.total += pay;
      m.set(j.cleaner_id, cur);
    }
    const list = [...m.entries()]
      .map(([cleanerId, v]) => ({ cleanerId, ...v }))
      .sort((a, b) => b.total - a.total);
    return {
      queue: list,
      queueTotal: list.reduce((s, c) => s + c.total, 0),
      queueCount: list.reduce((s, c) => s + c.jobs.length, 0),
      blockedNoRate: noRate,
    };
  }, [jobs, rateIndex, paidByJob]);

  // Earnings by cleaner for the selected period (completed + approved), with paid/owed tags.
  const byCleaner = useMemo(() => {
    const m = new Map<string, { name: string; cleans: number; cents: number; paidCents: number; jobs: CleaningJobWithRelations[] }>();
    for (const j of jobs ?? []) {
      if (!j.cleaner_id) continue;
      if (j.status !== "completed" && j.status !== "approved") continue;
      const d = new Date(jobDate(j));
      if (d < from || d > to) continue;
      const pay = effectivePayCents(j, rateIndex) ?? 0;
      const cur = m.get(j.cleaner_id) ?? { name: j.cleaner?.full_name ?? "Unknown", cleans: 0, cents: 0, paidCents: 0, jobs: [] };
      cur.cleans += 1;
      cur.cents += pay;
      if (paidByJob.has(j.id)) cur.paidCents += pay;
      cur.jobs.push(j);
      m.set(j.cleaner_id, cur);
    }
    return [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.cents - a.cents);
  }, [jobs, from, to, rateIndex, paidByJob]);

  const paidThisPeriod = useMemo(() => {
    return (payouts ?? [])
      .filter((p) => { const d = new Date(p.paid_at); return d >= from && d <= to; })
      .reduce((s, p) => s + p.amount_cents, 0);
  }, [payouts, from, to]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <div>
        <h1 className="text-4xl font-display font-semibold tracking-tight">Pay</h1>
        <p className="text-sm text-muted-foreground mt-1">What you owe your crew, with no marketplace cut. Pay them, then mark it here.</p>
      </div>

      <Tabs defaultValue="payouts">
        <TabsList>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="rates">Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="payouts" className="space-y-6 mt-4">

      {/* ---- To pay now (the queue) ---- */}
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : error ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-destructive">Failed to load pay: {error.message}</div>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">To pay now</div>
              <div className="text-4xl font-display font-semibold tracking-tight mt-1">{fmtMoney(queueTotal)}</div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div><span className="font-semibold text-foreground">{queueCount}</span> {queueCount === 1 ? "clean" : "cleans"}</div>
              <div><span className="font-semibold text-foreground">{queue.length}</span> {queue.length === 1 ? "cleaner" : "cleaners"}</div>
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
              <CheckCircle2 className="h-7 w-7 mx-auto text-emerald-600" />
              <p className="mt-2 font-medium text-sm">Crew's all paid up</p>
              <p className="text-xs text-muted-foreground mt-0.5">Every approved, priced clean has been paid.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((c) => (
                <div key={c.cleanerId} className="flex items-center gap-3 rounded-xl border border-border p-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.jobs.length} {c.jobs.length === 1 ? "clean" : "cleans"} ready</div>
                  </div>
                  <div className="font-mono font-semibold tabular-nums">{fmtMoney(c.total)}</div>
                  <Button
                    size="sm"
                    onClick={() => setPayTarget({ cleanerId: c.cleanerId, cleanerName: c.name, jobs: c.jobs })}
                  >
                    Mark paid
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Why some approved cleans aren't payable yet */}
          {blockedNoRate > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] text-amber-600 inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" /> {blockedNoRate} approved {blockedNoRate === 1 ? "clean has" : "cleans have"} no rate set — set one in the Rates tab.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ---- Failed/returned ACH — loud, because the cleaner wasn't paid ---- */}
      {!isLoading && !error && failedAch.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3.5">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-semibold text-destructive">{failedAch.length} ACH payment{failedAch.length === 1 ? "" : "s"} failed or returned.</span>{" "}
            <span className="text-muted-foreground">The cleaner wasn't paid — check the cleaner's bank details and re-send.</span>
          </div>
        </div>
      )}

      {/* ---- QuickBooks booking retry (only shows when something didn't book) ---- */}
      {!isLoading && !error && unbooked.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
          <BookCheck className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-medium">{unbooked.length}</span>{" "}
            {unbooked.length === 1 ? "payout isn't" : "payouts aren't"} in QuickBooks yet.
          </div>
          <Button size="sm" variant="outline" onClick={bookUnbooked} disabled={book.isPending}>
            {book.isPending ? "Booking…" : "Book to QuickBooks"}
          </Button>
        </div>
      )}

      {/* ---- Earnings by period ---- */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Earnings</h2>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`h-9 px-3 text-sm border-r border-border last:border-r-0 transition ${period === p.key ? "bg-foreground text-background" : "hover:bg-muted"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!isLoading && !error && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground -mt-2">
          <span>Paid in {label}: <span className="font-semibold text-foreground font-mono">{fmtMoney(paidThisPeriod)}</span></span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : error ? null : byCleaner.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Wallet className="h-9 w-9 mx-auto text-muted-foreground/40" />
          <p className="mt-3 font-medium">No completed cleans in {label}</p>
          <p className="text-sm text-muted-foreground mt-1">Earnings appear here as cleaners complete and you approve their work.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {byCleaner.map((c) => {
            const isOpen = expanded.has(c.id);
            const owed = c.cents - c.paidCents;
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button onClick={() => toggle(c.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.cleans} {c.cleans === 1 ? "clean" : "cleans"}
                      {owed > 0 && <span className="text-amber-600"> · {fmtMoney(owed)} owed</span>}
                    </div>
                  </div>
                  <div className="font-mono font-semibold tabular-nums">{fmtMoney(c.cents)}</div>
                </button>
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {c.jobs
                      .slice()
                      .sort((a, b) => new Date(jobDate(b)).getTime() - new Date(jobDate(a)).getTime())
                      .map((j) => {
                        const pay = effectivePayCents(j, rateIndex);
                        const payout = paidByJob.get(j.id);
                        return (
                          <div key={j.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                            <div className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                              {new Date(jobDate(j)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </div>
                            <div className="flex-1 min-w-0 truncate">{propLabel(j)}</div>
                            {payout ? (
                              <span className="text-[10px] font-medium inline-flex items-center gap-1.5">
                                <span className="text-emerald-600 inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> paid{payout.method ? ` · ${PAYOUT_METHOD_LABEL[payout.method] ?? payout.method}` : ""}
                                </span>
                                {payout.dwolla_transfer_id && (
                                  <span
                                    className={
                                      payout.dwolla_status === "processed" ? "text-emerald-600"
                                      : payout.dwolla_status === "failed" || payout.dwolla_status === "returned" ? "text-destructive"
                                      : "text-muted-foreground"
                                    }
                                    title={`ACH transfer ${payout.dwolla_status ?? "pending"}`}
                                  >
                                    · ACH {payout.dwolla_status ?? "pending"}
                                  </span>
                                )}
                                {payout.qb_purchase_id ? (
                                  <span className="text-muted-foreground inline-flex items-center gap-0.5" title="Booked in QuickBooks">
                                    <BookCheck className="h-3 w-3" /> QB
                                  </span>
                                ) : (
                                  <span className="text-amber-600" title={payout.qb_sync_error ?? "Not booked to QuickBooks yet"}>· not in QB</span>
                                )}
                              </span>
                            ) : j.status === "completed" ? (
                              <span className="text-[10px] text-muted-foreground">pending approval</span>
                            ) : (
                              <span className="text-[10px] text-amber-600 font-medium">owed</span>
                            )}
                            <div className="font-mono text-xs tabular-nums">{pay == null ? "—" : fmtMoney(pay)}</div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        "To pay now" is every approved clean with a rate that you haven't paid yet. Pay your crew however you like, then Mark paid to log it.
      </p>

        </TabsContent>

        <TabsContent value="rates" className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            Set what each cleaner earns per clean at each property. Saved rates flow into the queue above, each cleaner's day total, and QuickBooks.
          </p>
          <CrewRatesManager />
        </TabsContent>
      </Tabs>

      <RecordPayoutDialog target={payTarget} onClose={() => setPayTarget(null)} />
    </div>
  );
}

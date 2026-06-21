// Phase-1 payout recorder. Logs that a cleaner was paid for one or more cleans
// — you pay them your usual way (Zelle, check, etc.), then record it here so
// the Pay screen tracks owed vs paid. This is the manual rail; a future
// automated rail (QuickBooks Contractor Payments, Dwolla, Stripe) would write
// the same cleaner_payouts rows.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useRecordPayout,
  useBookPayouts,
  usePayViaAch,
  useCleanerDwolla,
  dwollaByCleaner,
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABEL,
  type PayoutMethod,
} from "@/lib/api/payouts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PayoutJob = {
  id: string;
  propertyId: string | null;
  propertyLabel: string;
  amountCents: number;
  date: string;
};

export type PayoutTarget = {
  cleanerId: string;
  cleanerName: string;
  jobs: PayoutJob[];
};

const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const todayInput = () => {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export function RecordPayoutDialog({
  target,
  onClose,
}: {
  target: PayoutTarget | null;
  onClose: () => void;
}) {
  const record = useRecordPayout();
  const book = useBookPayouts();
  const pay = usePayViaAch();
  const { data: dwolla } = useCleanerDwolla();
  const dd = target ? dwollaByCleaner(dwolla).get(target.cleanerId) : undefined;
  const [method, setMethod] = useState<PayoutMethod>("zelle");
  const [date, setDate] = useState(todayInput());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (target) {
      setMethod("zelle");
      setDate(todayInput());
      setNote("");
    }
  }, [target?.cleanerId, target?.jobs.length]);

  const total = (target?.jobs ?? []).reduce((s, j) => s + j.amountCents, 0);
  const count = target?.jobs.length ?? 0;

  // viaAch=true actually SENDS the money through Dwolla; false just logs that
  // you paid them outside the app. Both record the payout + book it to QuickBooks.
  async function confirm(viaAch: boolean) {
    if (!target) return;
    const paid_at = new Date(`${date}T12:00:00`).toISOString();
    let recorded: { id: string }[];
    try {
      recorded = await Promise.all(
        target.jobs.map((j) =>
          record.mutateAsync({
            job_id: j.id,
            cleaner_id: target.cleanerId,
            property_id: j.propertyId,
            amount_cents: j.amountCents,
            method: viaAch ? "dwolla" : method,
            note: note.trim() || null,
            paid_at,
          }),
        ),
      );
    } catch (e) {
      toast.error(`Couldn't record payout: ${e instanceof Error ? e.message : "unknown error"}`);
      return;
    }
    const ids = recorded.map((r) => r.id);

    // The payment step. ACH actually moves money; otherwise it's already paid.
    if (viaAch) {
      try {
        const results = await pay.mutateAsync(ids);
        const failed = results.find((r) => r.status === "error");
        if (failed) {
          toast.warning(`Recorded, but the ACH send failed: ${failed.error}. Retry from Pay.`);
        } else {
          toast.success(`Sent ${fmtMoney(total)} to ${target.cleanerName} via ACH`);
        }
      } catch (e) {
        toast.warning(`Recorded, but couldn't reach Dwolla: ${e instanceof Error ? e.message : "error"}. Retry from Pay.`);
      }
    } else {
      toast.success(`Recorded ${fmtMoney(total)} to ${target.cleanerName} (${count} ${count === 1 ? "clean" : "cleans"})`);
    }

    // Book the expense to QuickBooks either way (a QB hiccup never blocks payment).
    try {
      const results = await book.mutateAsync(ids);
      if (results.some((r) => r.status === "error")) toast.message("QuickBooks booking pending — retry from Pay.");
    } catch { /* surfaced by the Pay hub's retry banner */ }
    onClose();
  }

  const busy = record.isPending || book.isPending || pay.isPending;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay {target?.cleanerName}</DialogTitle>
          <DialogDescription>
            {count} {count === 1 ? "clean" : "cleans"}.{" "}
            {dd?.bank_last4
              ? <>Send by ACH to ••{dd.bank_last4}, or log a payment you made another way.</>
              : <>This logs a payment you made your usual way. Set up direct deposit in the Rates tab to pay by ACH from here.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-40 overflow-y-auto divide-y divide-border">
            {(target?.jobs ?? []).map((j) => (
              <div key={j.id} className="flex items-center justify-between gap-3 py-1.5 text-sm first:pt-0 last:pb-0">
                <span className="truncate">{j.propertyLabel}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(j.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span className="font-mono tabular-nums shrink-0">{fmtMoney(j.amountCents)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-display font-semibold tracking-tight">{fmtMoney(total)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payout-method" className="text-xs">Paid via</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PayoutMethod)}>
                <SelectTrigger id="payout-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYOUT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{PAYOUT_METHOD_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-date" className="text-xs">Date paid</Label>
              <Input id="payout-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payout-note" className="text-xs">Note (optional)</Label>
            <Textarea
              id="payout-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder="e.g. Zelle confirmation #, or anything to remember"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          {dd?.bank_last4 ? (
            <>
              <Button variant="ghost" onClick={() => confirm(false)} disabled={busy || count === 0}>
                Log as paid
              </Button>
              <Button onClick={() => confirm(true)} disabled={busy || count === 0}>
                {pay.isPending ? "Sending…" : busy ? "Working…" : `Pay ${fmtMoney(total)} via ACH`}
              </Button>
            </>
          ) : (
            <Button onClick={() => confirm(false)} disabled={busy || count === 0}>
              {record.isPending ? "Recording…" : book.isPending ? "Booking…" : `Mark ${fmtMoney(total)} paid`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

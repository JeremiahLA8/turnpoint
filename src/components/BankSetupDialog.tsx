// Set up a cleaner's bank for direct deposit (Dwolla ACH).
//
// Bank numbers are sent straight to Dwolla via the edge function and are NEVER
// stored in our database — we keep only Dwolla's ids + a last4 for display.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useOnboardCleanerBank } from "@/lib/api/payouts";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock } from "lucide-react";

export type BankSetupTarget = { cleanerId: string; cleanerName: string; currentLast4?: string | null };

export function BankSetupDialog({ target, onClose }: { target: BankSetupTarget | null; onClose: () => void }) {
  const onboard = useOnboardCleanerBank();
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [type, setType] = useState<"checking" | "savings">("checking");

  useEffect(() => {
    if (target) { setRouting(""); setAccount(""); setType("checking"); }
  }, [target?.cleanerId]);

  const routingOk = /^\d{9}$/.test(routing.trim());
  const accountOk = /^\d{4,17}$/.test(account.trim());
  const valid = routingOk && accountOk;

  async function save() {
    if (!target || !valid) return;
    try {
      const { last4 } = await onboard.mutateAsync({
        cleaner_id: target.cleanerId,
        routingNumber: routing.trim(),
        accountNumber: account.trim(),
        bankAccountType: type,
      });
      toast.success(`Direct deposit set up for ${target.cleanerName} (••${last4})`);
      onClose();
    } catch (e) {
      toast.error(`Couldn't set up direct deposit: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Direct deposit</DialogTitle>
          <DialogDescription>
            Bank account for paying <span className="font-medium text-foreground">{target?.cleanerName}</span> by ACH.
            {target?.currentLast4 && <> Currently ••{target.currentLast4} — saving replaces it.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="bank-routing" className="text-xs">Routing number</Label>
            <Input
              id="bank-routing"
              value={routing}
              onChange={(e) => setRouting(e.target.value.replace(/\D/g, "").slice(0, 9))}
              inputMode="numeric"
              placeholder="9 digits"
              className={`font-mono ${routing && !routingOk ? "border-destructive" : ""}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bank-account" className="text-xs">Account number</Label>
              <Input
                id="bank-account"
                value={account}
                onChange={(e) => setAccount(e.target.value.replace(/\D/g, "").slice(0, 17))}
                inputMode="numeric"
                placeholder="4–17 digits"
                className={`font-mono ${account && !accountOk ? "border-destructive" : ""}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-type" className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "checking" | "savings")}>
                <SelectTrigger id="bank-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> Sent securely to Dwolla. We never store the account number.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={onboard.isPending}>Cancel</Button>
          <Button onClick={save} disabled={!valid || onboard.isPending}>
            {onboard.isPending ? "Saving…" : "Save bank"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

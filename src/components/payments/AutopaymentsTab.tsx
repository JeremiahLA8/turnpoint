import { useState } from "react";
import { autopaymentRules as seed, teammates, type AutopaymentRule, type PaymentMethod } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const AutopaymentsTab = ({ methods }: { methods: PaymentMethod[] }) => {
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<AutopaymentRule[]>(seed);
  const [open, setOpen] = useState(false);

  const cleaners = teammates.filter((t) => t.role.toLowerCase().includes("cleaning"));

  const [cleaner, setCleaner] = useState("");
  const [trigger, setTrigger] = useState<"after_completion" | "weekly">("after_completion");
  const [weekday, setWeekday] = useState("Friday");
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [cap, setCap] = useState("");

  const reset = () => { setCleaner(""); setTrigger("after_completion"); setWeekday("Friday"); setMethodId(methods[0]?.id ?? ""); setCap(""); };

  const submit = () => {
    if (!cleaner || !methodId) {
      toast({ title: "Missing info", description: "Cleaner and payment method are required." });
      return;
    }
    const rule: AutopaymentRule = {
      id: `ap-${Date.now()}`,
      cleaner,
      trigger,
      weekday: trigger === "weekly" ? weekday : undefined,
      methodId,
      cap: cap ? Number(cap) : undefined,
      enabled: true,
    };
    setRules((prev) => [...prev, rule]);
    setOpen(false);
    reset();
    toast({ title: "Autopayment rule added" });
  };

  const toggle = (id: string) => setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  const remove = (id: string) => { setRules((prev) => prev.filter((r) => r.id !== id)); toast({ title: "Rule removed" }); };

  const methodLabel = (id: string) => {
    const m = methods.find((x) => x.id === id);
    return m ? `${m.brand} •••• ${m.last4}` : "—";
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Enable autopayments</div>
            <p className="text-sm text-muted-foreground">Automatically pay cleaners using your default rules below.</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Rules</h3>
        <Button onClick={() => setOpen(true)} disabled={!enabled || methods.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Add autopayment rule
        </Button>
      </div>

      {methods.length === 0 && (
        <div className="text-sm text-muted-foreground">Add a payment method first to create autopayment rules.</div>
      )}

      {rules.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">No autopayment rules yet.</div>
      ) : (
        <div className={`space-y-3 ${!enabled ? "opacity-50 pointer-events-none" : ""}`}>
          {rules.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{r.cleaner}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {r.trigger === "after_completion" ? "After each cleaning" : `Weekly · ${r.weekday}`}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Pays from <span className="font-mono">{methodLabel(r.methodId)}</span>
                  {r.cap ? ` · Cap $${r.cap}/period` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={r.enabled} onCheckedChange={() => toggle(r.id)} />
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New autopayment rule</DialogTitle>
            <DialogDescription>Pay a cleaner automatically based on a trigger.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Cleaner</Label>
              <Select value={cleaner} onValueChange={setCleaner}>
                <SelectTrigger><SelectValue placeholder="Select cleaner" /></SelectTrigger>
                <SelectContent>
                  {cleaners.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={trigger} onValueChange={(v) => setTrigger(v as "after_completion" | "weekly")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="after_completion">After each completed cleaning</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {trigger === "weekly" && (
              <div className="space-y-2">
                <Label>Day</Label>
                <Select value={weekday} onValueChange={setWeekday}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {weekdays.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={methodId} onValueChange={setMethodId}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.brand} •••• {m.last4}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Spending cap per period (optional)</Label>
              <Input type="number" min="0" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="$" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Add rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

import { useState } from "react";
import { z } from "zod";
import { paymentMethods as seed, type PaymentMethod } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Landmark, Plus, Trash2, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Luhn check for card numbers
const luhn = (num: string) => {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
};

const expValid = (exp: string) => {
  const m = exp.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const mm = parseInt(m[1], 10);
  const yy = parseInt(m[2], 10);
  if (mm < 1 || mm > 12) return false;
  const now = new Date();
  const expiry = new Date(2000 + yy, mm); // first day of next month
  return expiry > now;
};

const holderSchema = z.string().trim().min(2, "Holder name is too short").max(100, "Max 100 characters").regex(/^[a-zA-Z\s.'-]+$/, "Letters, spaces, . ' - only");

const cardSchema = z.object({
  holder: holderSchema,
  number: z.string().trim().refine((v) => luhn(v), { message: "Invalid card number" }),
  exp: z.string().trim().refine(expValid, { message: "Invalid or expired (use MM/YY)" }),
  cvc: z.string().trim().regex(/^\d{3,4}$/, "CVC must be 3–4 digits"),
});

const bankSchema = z.object({
  holder: holderSchema,
  routing: z.string().trim().regex(/^\d{9}$/, "Routing number must be 9 digits"),
  number: z.string().trim().regex(/^\d{6,17}$/, "Account number must be 6–17 digits"),
});

type Errors = Partial<Record<"holder" | "number" | "exp" | "cvc" | "routing", string>>;

export const PaymentMethodsTab = ({
  methods,
  setMethods,
}: {
  methods: PaymentMethod[];
  setMethods: React.Dispatch<React.SetStateAction<PaymentMethod[]>>;
}) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"card" | "bank">("card");
  const [holder, setHolder] = useState("");
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [routing, setRouting] = useState("");
  const [brand, setBrand] = useState("Visa");
  const [errors, setErrors] = useState<Errors>({});
  const [nearDup, setNearDup] = useState<{ method: PaymentMethod; reason: string } | null>(null);

  const reset = () => {
    setHolder(""); setNumber(""); setExp(""); setCvc(""); setRouting(""); setBrand("Visa"); setType("card"); setErrors({}); setNearDup(null);
  };

  const submit = () => {
    const result = type === "card"
      ? cardSchema.safeParse({ holder, number, exp, cvc })
      : bankSchema.safeParse({ holder, routing, number });

    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof Errors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast({ title: "Please fix the highlighted fields" });
      return;
    }

    setErrors({});
    const cleanNumber = number.replace(/\D/g, "");
    const last4 = cleanNumber.slice(-4);

    const duplicate = methods.some((m) => {
      if (m.type !== type) return false;
      if (m.last4 !== last4) return false;
      if (type === "card") return m.brand === brand;
      // bank: also match routing via stored exp slot? we don't store routing — treat last4 + holder match as dup
      return m.holder.toLowerCase() === holder.trim().toLowerCase();
    });
    if (duplicate) {
      const key = type === "card" ? "number" : "number";
      setErrors({ [key]: "This payment method is already on your account" } as Errors);
      toast({ title: "Duplicate payment method", description: "This account is already saved." });
      return;
    }
    // Near-duplicate detection: same type + same last4, but not an exact duplicate
    const near = methods.find((m) => {
      if (m.type !== type) return false;
      if (m.last4 !== last4) return false;
      if (type === "card") return m.brand !== brand; // same last4, different brand
      return m.holder.toLowerCase() !== holder.trim().toLowerCase(); // same last4, different holder
    });
    if (near) {
      const reason = type === "card"
        ? `You already have a ${near.brand} card ending in ${near.last4}. This new ${brand} card shares the same last 4 digits.`
        : `You already have a bank account ending in ${near.last4} for ${near.holder}. This entry uses a different account holder name.`;
      setNearDup({ method: near, reason });
      return;
    }

    finalizeAdd(last4);
  };

  const finalizeAdd = (last4: string) => {
    const newMethod: PaymentMethod = {
      id: `pm-${Date.now()}`,
      type,
      brand: type === "card" ? brand : "Bank account",
      last4,
      exp: type === "card" ? exp : undefined,
      holder: holder.trim(),
      isDefault: methods.length === 0,
    };
    setMethods((prev) => [...prev, newMethod]);
    setOpen(false);
    reset();
    toast({ title: "Payment method added" });
  };

  const setDefault = (id: string) => {
    setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })));
    toast({ title: "Default updated" });
  };

  const remove = (id: string) => {
    setMethods((prev) => prev.filter((m) => m.id !== id));
    toast({ title: "Payment method removed" });
  };

  const errClass = (k: keyof Errors) => (errors[k] ? "border-destructive focus-visible:ring-destructive" : "");
  const ErrorText = ({ k }: { k: keyof Errors }) => errors[k]
    ? <p className="text-xs text-destructive mt-1">{errors[k]}</p>
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Saved methods</h3>
          <p className="text-sm text-muted-foreground">Cards and bank accounts on file for payouts and charges.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add payment method</Button>
      </div>

      {methods.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          No payment methods yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {methods.map((m) => (
            <div key={m.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                {m.type === "card" ? <CreditCard className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{m.brand}</span>
                  <span className="font-mono text-sm text-muted-foreground">•••• {m.last4}</span>
                  {m.isDefault && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">Default</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {m.holder}{m.exp ? ` · Exp ${m.exp}` : ""}
                </div>
                <div className="flex gap-2 mt-3">
                  {!m.isDefault && (
                    <Button size="sm" variant="outline" onClick={() => setDefault(m.id)}>
                      <Star className="h-3 w-3 mr-1" /> Set as default
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(m.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add payment method</DialogTitle>
            <DialogDescription>This is a demo form — no real payment details are stored.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => { setType(v as "card" | "bank"); setErrors({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Credit / debit card</SelectItem>
                  <SelectItem value="bank">Bank account (ACH)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{type === "card" ? "Cardholder name" : "Account holder"}</Label>
              <Input value={holder} maxLength={100} onChange={(e) => setHolder(e.target.value)} placeholder="Full name" className={cn(errClass("holder"))} aria-invalid={!!errors.holder} />
              <ErrorText k="holder" />
            </div>

            {type === "card" ? (
              <>
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select value={brand} onValueChange={setBrand}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Visa", "Mastercard", "Amex", "Discover"].map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Card number</Label>
                  <Input
                    value={number}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 19);
                      const grouped = digits.replace(/(.{4})/g, "$1 ").trim();
                      setNumber(grouped);
                    }}
                    placeholder="1234 5678 9012 3456"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    className={cn(errClass("number"))}
                    aria-invalid={!!errors.number}
                  />
                  <ErrorText k="number" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Expiry</Label>
                    <Input
                      value={exp}
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                        setExp(v);
                      }}
                      placeholder="MM/YY"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      maxLength={5}
                      className={cn(errClass("exp"))}
                      aria-invalid={!!errors.exp}
                    />
                    <ErrorText k="exp" />
                  </div>
                  <div className="space-y-1">
                    <Label>CVC</Label>
                    <Input
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="123"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      className={cn(errClass("cvc"))}
                      aria-invalid={!!errors.cvc}
                    />
                    <ErrorText k="cvc" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Routing number</Label>
                  <Input
                    value={routing}
                    onChange={(e) => setRouting(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    placeholder="9 digits"
                    inputMode="numeric"
                    className={cn(errClass("routing"))}
                    aria-invalid={!!errors.routing}
                  />
                  <ErrorText k="routing" />
                </div>
                <div className="space-y-1">
                  <Label>Account number</Label>
                  <Input
                    value={number}
                    onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 17))}
                    placeholder="Account number"
                    inputMode="numeric"
                    className={cn(errClass("number"))}
                    aria-invalid={!!errors.number}
                  />
                  <ErrorText k="number" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Add method</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!nearDup} onOpenChange={(o) => { if (!o) setNearDup(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Possible duplicate payment method</AlertDialogTitle>
            <AlertDialogDescription>
              {nearDup?.reason} Are you sure you want to add it anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review details</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const last4 = number.replace(/\D/g, "").slice(-4);
                setNearDup(null);
                finalizeAdd(last4);
              }}
            >
              Add anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

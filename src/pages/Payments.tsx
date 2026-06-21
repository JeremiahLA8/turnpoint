import { useState } from "react";
import { payments, paymentMethods as seedMethods, type PaymentMethod } from "@/data/mockData";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PaymentMethodsTab } from "@/components/payments/PaymentMethodsTab";
import { PaymentHistoryTab } from "@/components/payments/PaymentHistoryTab";
import { AutopaymentsTab } from "@/components/payments/AutopaymentsTab";

const Payments = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>(seedMethods);

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const paid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pending = total - paid;

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { l: "TOTAL THIS MONTH", v: `$${total.toFixed(0)}` },
          { l: "PAID", v: `$${paid.toFixed(0)}` },
          { l: "PENDING", v: `$${pending.toFixed(0)}`, danger: true },
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-xl p-5">
            <div className="text-xs font-mono text-muted-foreground mb-2">{s.l}</div>
            <div className={`text-3xl font-bold ${s.danger ? "text-warning" : ""}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="methods">
        <TabsList>
          <TabsTrigger value="methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="autopayments">Autopayments</TabsTrigger>
        </TabsList>
        <TabsContent value="methods" className="mt-6">
          <PaymentMethodsTab methods={methods} setMethods={setMethods} />
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <PaymentHistoryTab methods={methods} />
        </TabsContent>
        <TabsContent value="autopayments" className="mt-6">
          <AutopaymentsTab methods={methods} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Payments;

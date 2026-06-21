import type { Property } from "@/lib/api/properties";
import type { PropertyAssignments } from "@/data/mockData";
import { paymentMethods, payments } from "@/data/mockData";
import { CreditCard, Landmark, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PropertyCrewPay } from "@/components/properties/PropertyCrewPay";

export const PropertyPaymentsTab = ({
  property,
  assignments,
}: {
  property: Property;
  assignments: PropertyAssignments;
}) => {
  const linked = paymentMethods.filter((m) => assignments.paymentMethodIds.includes(m.id));
  const payout = paymentMethods.find((m) => m.id === assignments.payoutMethodId);
  const propertyPayments = payments.filter((p) =>
    p.property.toLowerCase().includes(property.name.toLowerCase().split(" ")[0]),
  );

  return (
    <div className="space-y-5">
      <PropertyCrewPay propertyId={property.id} />

      <Section title="Payment methods used for this property">
        {linked.length === 0 ? (
          <Empty text="No payment methods attached yet." />
        ) : (
          <div className="divide-y divide-border">
            {linked.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  {m.type === "card" ? <CreditCard className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.brand} •••• {m.last4}</div>
                  <div className="text-xs text-muted-foreground">{m.holder}{m.exp ? ` · exp ${m.exp}` : ""}</div>
                </div>
                {m.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Payout account (where this property's revenue lands)">
        {payout ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
              <Landmark className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium">{payout.brand} •••• {payout.last4}</div>
              <div className="text-xs text-muted-foreground">{payout.holder}</div>
            </div>
            <Badge className="text-[10px] inline-flex items-center gap-1"><Check className="h-3 w-3" /> Active</Badge>
          </div>
        ) : (
          <Empty text="No payout account set." />
        )}
      </Section>

      <Section title={`Recent payments (${propertyPayments.length})`}>
        {propertyPayments.length === 0 ? (
          <Empty text="No payments recorded for this property yet." />
        ) : (
          <div className="divide-y divide-border">
            {propertyPayments.map((p) => (
              <div key={p.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="text-xs text-muted-foreground font-mono w-28 shrink-0">{p.date}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.cleaner}</div>
                  <div className="text-xs text-muted-foreground capitalize">{p.status}</div>
                </div>
                <div className="font-mono font-semibold">${p.amount}</div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-card border border-border rounded-xl p-6">
    <h2 className="font-bold mb-4">{title}</h2>
    {children}
  </section>
);

const Empty = ({ text }: { text: string }) => (
  <div className="text-sm text-muted-foreground text-center py-6">{text}</div>
);

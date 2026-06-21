import { useMemo, useState } from "react";
import { payments, type PaymentMethod } from "@/data/mockData";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export const PaymentHistoryTab = ({ methods }: { methods: PaymentMethod[] }) => {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [methodId, setMethodId] = useState<string>("all");

  const methodLabel = (id: string) => {
    const m = methods.find((x) => x.id === id);
    return m ? `${m.brand} •••• ${m.last4}` : "—";
  };

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (methodId !== "all" && p.methodId !== methodId) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!p.cleaner.toLowerCase().includes(q) && !p.property.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [query, status, methodId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search cleaner or property" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodId} onValueChange={setMethodId}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {methods.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.brand} •••• {m.last4}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs font-mono uppercase">
            <tr>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Cleaner</th>
              <th className="text-left p-4">Property</th>
              <th className="text-left p-4">Method</th>
              <th className="text-right p-4">Amount</th>
              <th className="text-right p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No matching payments</td></tr>
            ) : filtered.map((p) => (
              <tr key={p.id} className="hover:bg-muted/40">
                <td className="p-4 text-muted-foreground">{p.date}</td>
                <td className="p-4 font-medium">{p.cleaner}</td>
                <td className="p-4 text-primary">{p.property}</td>
                <td className="p-4 font-mono text-xs">{methodLabel(p.methodId)}</td>
                <td className="p-4 text-right font-mono">${p.amount}</td>
                <td className="p-4 text-right">
                  <span className={`text-xs font-mono uppercase px-2 py-1 rounded-full ${p.status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

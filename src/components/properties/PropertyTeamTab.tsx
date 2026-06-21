import { useState } from "react";
import type { PropertyAssignments } from "@/data/mockData";
import { propertyOwners, teammates } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, X, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PropertyTeamTab = ({ assignments }: { assignments: PropertyAssignments }) => {
  const [ownerId, setOwnerId] = useState<string | null>(assignments.ownerId);
  const [cleanerIds, setCleanerIds] = useState<string[]>(assignments.cleanerIds);
  const [adding, setAdding] = useState(false);

  const owner = ownerId ? propertyOwners.find((o) => o.id === ownerId) : null;
  const assignedCleaners = cleanerIds.map((id) => teammates.find((t) => t.id === id)).filter(Boolean);
  const availableCleaners = teammates.filter((t) => !cleanerIds.includes(t.id));

  return (
    <div className="space-y-5">
      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Owner</h2>
          <Select value={ownerId ?? ""} onValueChange={(v) => setOwnerId(v)}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select owner" /></SelectTrigger>
            <SelectContent>
              {propertyOwners.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {owner ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
              {owner.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{owner.name}</div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-0.5">
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {owner.email}</span>
                <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {owner.phone}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">No owner assigned.</div>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Cleaners ({assignedCleaners.length})</h2>
          <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add cleaner
          </Button>
        </div>

        {adding && availableCleaners.length > 0 && (
          <div className="mb-4">
            <Select onValueChange={(v) => { setCleanerIds((ids) => [...ids, v]); setAdding(false); }}>
              <SelectTrigger><SelectValue placeholder="Choose a teammate to assign…" /></SelectTrigger>
              <SelectContent>
                {availableCleaners.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} — {t.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {assignedCleaners.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">No cleaners assigned.</div>
        ) : (
          <div className="divide-y divide-border">
            {assignedCleaners.map((t) => (
              <div key={t!.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-semibold text-sm">
                  {t!.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t!.name}</div>
                  <div className="text-xs text-muted-foreground">{t!.role}</div>
                </div>
                <Badge variant="outline" className="text-[10px]">★ {t!.rating}</Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setCleanerIds((ids) => ids.filter((id) => id !== t!.id))}
                  aria-label="Remove cleaner"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

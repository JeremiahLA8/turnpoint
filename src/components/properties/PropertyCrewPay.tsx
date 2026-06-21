// Turnpoint — per-property crew pay rates.
//
// Set what each cleaner earns per clean at this property. Saved rates flow
// straight into the Pay screen and each cleaner's "My day" total via the
// read-time resolution in src/lib/api/payRates.ts. A blank field means "no
// rate" (the cleaner doesn't work here, or it's billed some other way).

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCleaners, type Cleaner } from "@/lib/api/cleaners";
import {
  usePayRates,
  useUpsertPayRate,
  useDeletePayRate,
  type PropertyCleanerRate,
} from "@/lib/api/payRates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet } from "lucide-react";

export function PropertyCrewPay({ propertyId }: { propertyId: string }) {
  const { data: cleaners, isLoading: loadingCleaners, error: cleanersErr } = useCleaners();
  const { data: rates, isLoading: loadingRates, error: ratesErr } = usePayRates();

  const isLoading = loadingCleaners || loadingRates;
  const error = cleanersErr || ratesErr;

  const ratesForProperty = new Map<string, PropertyCleanerRate>();
  for (const r of rates ?? []) {
    if (r.property_id === propertyId) ratesForProperty.set(r.cleaner_id, r);
  }

  return (
    <section className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start gap-2 mb-1">
        <Wallet className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <h2 className="font-bold">Crew pay</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        What each cleaner earns per clean here. Flows into Pay and the cleaner's day total. Leave
        blank for cleaners who don't work this property.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive text-center py-4">
          Couldn't load crew pay: {error.message}
        </div>
      ) : !cleaners || cleaners.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4">
          No cleaners yet. Add cleaner accounts, then set their rates here.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {cleaners.map((c) => (
            <CrewPayRow
              key={c.id}
              propertyId={propertyId}
              cleaner={c}
              rate={ratesForProperty.get(c.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CrewPayRow({
  propertyId,
  cleaner,
  rate,
}: {
  propertyId: string;
  cleaner: Cleaner;
  rate: PropertyCleanerRate | undefined;
}) {
  const saved = rate ? String(rate.amount_cents / 100) : "";
  const [value, setValue] = useState(saved);
  const upsert = useUpsertPayRate();
  const del = useDeletePayRate();

  // Re-sync when the saved rate changes (after a save, or an edit elsewhere).
  // Mid-typing this is a no-op because `saved` only moves once the write lands.
  useEffect(() => setValue(saved), [saved]);

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
          cleaner_id: cleaner.id,
          amount_cents: Math.round(parsed * 100),
        });
      }
      toast.success(`Saved ${cleaner.full_name ?? "cleaner"}'s rate`);
    } catch (e) {
      toast.error(`Couldn't save: ${(e as Error).message}`);
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{cleaner.full_name ?? "Unnamed cleaner"}</div>
      </div>
      <div className="relative w-28 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          inputMode="decimal"
          placeholder="—"
          aria-label={`${cleaner.full_name ?? "Cleaner"} rate per clean`}
          aria-invalid={invalid}
          className={`pl-6 font-mono text-right ${invalid ? "border-destructive" : ""}`}
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

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InventoryItem } from "@/data/mockData";
import { properties as allProperties } from "@/data/mockData";
import { ExternalLink, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: InventoryItem | null;
  /** Optional single-property scope; if omitted, reorders across all low properties */
  propertyId?: string;
  onOrdered?: (itemId: string) => void;
};

export function AutoReorderDialog({ open, onOpenChange, item, propertyId, onOrdered }: Props) {
  const targets = useMemo(() => {
    if (!item) return [] as { id: string; name: string; needed: number }[];
    const ids = propertyId ? [propertyId] : Object.keys(item.perProperty);
    return ids
      .map((id) => {
        const lvl = item.perProperty[id];
        const needed = Math.max(0, lvl.max - lvl.current);
        const name = allProperties.find((p) => p.id === id)?.name ?? id;
        return { id, name, needed };
      })
      .filter((t) => t.needed > 0);
  }, [item, propertyId]);

  const totalQty = targets.reduce((s, t) => s + t.needed, 0);
  const [qty, setQty] = useState(totalQty);

  // sync qty when item/targets change
  useMemo(() => setQty(totalQty), [totalQty]);

  if (!item) return null;
  const cost = (item.unitCost ?? 0) * qty;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Auto-reorder · {item.name}
          </DialogTitle>
          <DialogDescription>
            One-click restock from Amazon. Confirm the quantity and we'll mark it as ordered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1.5">
            {targets.length === 0 && (
              <div className="text-muted-foreground">All properties are above reorder threshold.</div>
            )}
            {targets.map((t) => (
              <div key={t.id} className="flex justify-between">
                <span className="truncate pr-2">{t.name}</span>
                <span className="font-mono">+{t.needed} {item.unit}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Quantity</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Estimated cost</Label>
              <div className="h-10 flex items-center px-3 rounded-md border border-border bg-muted/40 font-mono text-sm">
                ${cost.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" asChild>
            <a href={item.amazonUrl ?? "https://www.amazon.com"} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1.5" /> Open in Amazon
            </a>
          </Button>
          <Button
            onClick={() => {
              onOrdered?.(item.id);
              toast.success(`Ordered ${qty} ${item.unit} of ${item.name}`, {
                description: "We'll mark it as pending until delivery is confirmed.",
              });
              onOpenChange(false);
            }}
            disabled={qty <= 0}
          >
            Place 1-click order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

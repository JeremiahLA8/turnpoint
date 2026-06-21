import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { properties as allProperties } from "@/data/mockData";
import type { InventoryCategory, InventoryItem, InventoryLevel } from "@/data/mockData";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: InventoryItem | null;
  onSave: (item: InventoryItem) => void;
};

const CATEGORIES: InventoryCategory[] = ["Linens", "Kitchen", "Bath", "Cleaning", "Other"];

export function InventoryItemDialog({ open, onOpenChange, item, onSave }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("Other");
  const [unit, setUnit] = useState("each");
  const [amazonUrl, setAmazonUrl] = useState("");
  const [unitCost, setUnitCost] = useState<number>(0);
  const [defaults, setDefaults] = useState({ current: 0, reorderAt: 2, max: 10 });
  const [perProperty, setPerProperty] = useState<Record<string, InventoryLevel>>({});

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setCategory(item?.category ?? "Other");
      setUnit(item?.unit ?? "each");
      setAmazonUrl(item?.amazonUrl ?? "");
      setUnitCost(item?.unitCost ?? 0);
      setPerProperty(item?.perProperty ?? {});
      setDefaults({ current: 0, reorderAt: 2, max: 10 });
    }
  }, [open, item]);

  const togglePropery = (id: string, on: boolean) => {
    setPerProperty((prev) => {
      const next = { ...prev };
      if (on) next[id] = next[id] ?? { ...defaults };
      else delete next[id];
      return next;
    });
  };

  const updateLevel = (id: string, key: keyof InventoryLevel, val: number) => {
    setPerProperty((prev) => ({ ...prev, [id]: { ...prev[id], [key]: val } }));
  };

  const applyDefaults = () => {
    setPerProperty((prev) => {
      const next: Record<string, InventoryLevel> = {};
      for (const id of Object.keys(prev)) next[id] = { ...defaults };
      return next;
    });
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (Object.keys(perProperty).length === 0) {
      toast.error("Select at least one property");
      return;
    }
    onSave({
      id: item?.id ?? `it${Date.now()}`,
      name: name.trim(),
      category,
      unit,
      amazonUrl: amazonUrl.trim() || undefined,
      unitCost: unitCost || undefined,
      perProperty,
      reorderPending: item?.reorderPending,
      lastOrderedAt: item?.lastOrderedAt,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add inventory item"}</DialogTitle>
          <DialogDescription>
            Set defaults, then assign properties and tune per-property thresholds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bath towels" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as InventoryCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="each, pack, bottle…" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit cost ($)</Label>
              <Input type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Amazon URL</Label>
              <Input value={amazonUrl} onChange={(e) => setAmazonUrl(e.target.value)} placeholder="https://amazon.com/…" />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase text-muted-foreground">Defaults</Label>
              <Button type="button" size="sm" variant="ghost" onClick={applyDefaults}>Apply to all selected</Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Current</Label>
                <Input type="number" min={0} value={defaults.current} onChange={(e) => setDefaults({ ...defaults, current: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reorder at</Label>
                <Input type="number" min={0} value={defaults.reorderAt} onChange={(e) => setDefaults({ ...defaults, reorderAt: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max</Label>
                <Input type="number" min={1} value={defaults.max} onChange={(e) => setDefaults({ ...defaults, max: Number(e.target.value) })} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Properties</Label>
            <div className="rounded-lg border border-border divide-y divide-border">
              {allProperties.map((p) => {
                const checked = !!perProperty[p.id];
                const lvl = perProperty[p.id];
                return (
                  <div key={p.id} className="p-3 space-y-2">
                    <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={(v) => togglePropery(p.id, !!v)} />
                      <span className="truncate text-sm">{p.name}</span>
                    </label>
                    {checked && lvl && (
                      <div className="grid grid-cols-3 gap-2 pl-6">
                        <div className="space-y-1 min-w-0">
                          <Label className="text-[10px] uppercase text-muted-foreground">Current</Label>
                          <Input className="w-full" type="number" min={0} value={lvl.current} onChange={(e) => updateLevel(p.id, "current", Number(e.target.value))} />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <Label className="text-[10px] uppercase text-muted-foreground">Reorder</Label>
                          <Input className="w-full" type="number" min={0} value={lvl.reorderAt} onChange={(e) => updateLevel(p.id, "reorderAt", Number(e.target.value))} />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <Label className="text-[10px] uppercase text-muted-foreground">Max</Label>
                          <Input className="w-full" type="number" min={1} value={lvl.max} onChange={(e) => updateLevel(p.id, "max", Number(e.target.value))} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{item ? "Save changes" : "Add item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

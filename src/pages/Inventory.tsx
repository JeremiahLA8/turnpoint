import { useMemo, useState } from "react";
import { inventoryItems as seed, properties as allProperties } from "@/data/mockData";
import type { InventoryItem } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StockBar, stockStatus } from "@/components/inventory/StockBar";
import { AutoReorderDialog } from "@/components/inventory/AutoReorderDialog";
import { InventoryItemDialog } from "@/components/inventory/InventoryItemDialog";
import { Plus, Pencil, ShoppingCart, Package, AlertTriangle, XCircle, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ItemRollup = {
  current: number;
  reorderAt: number;
  max: number;
  status: "ok" | "low" | "out";
  lowProps: number;
};

function rollup(item: InventoryItem): ItemRollup {
  const ids = Object.keys(item.perProperty);
  let current = 0, reorderAt = 0, max = 0, lowProps = 0;
  for (const id of ids) {
    const l = item.perProperty[id];
    current += l.current; reorderAt += l.reorderAt; max += l.max;
    if (l.current <= l.reorderAt) lowProps++;
  }
  const s = current <= 0 ? "out" : current <= reorderAt ? "low" : "ok";
  return { current, reorderAt, max, status: s, lowProps };
}

const Inventory = () => {
  const [items, setItems] = useState<InventoryItem[]>(seed);
  const [reorderItem, setReorderItem] = useState<{ item: InventoryItem; propertyId?: string } | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [propertyId, setPropertyId] = useState<string>(allProperties[0]?.id ?? "");

  const kpis = useMemo(() => {
    let low = 0, out = 0, pending = 0;
    for (const it of items) {
      const r = rollup(it);
      if (r.status === "low") low++;
      if (r.status === "out") out++;
      if (it.reorderPending) pending++;
    }
    return { total: items.length, low, out, pending };
  }, [items]);

  const upsert = (next: InventoryItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === next.id);
      if (idx === -1) return [next, ...prev];
      const copy = prev.slice(); copy[idx] = next; return copy;
    });
    toast.success("Inventory item saved");
  };

  const markOrdered = (itemId: string) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, reorderPending: true, lastOrderedAt: new Date().toISOString() } : i)));
  };

  const openAdd = () => { setEditItem(null); setDialogOpen(true); };
  const openEdit = (it: InventoryItem) => { setEditItem(it); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">Track supply levels per property and one-click reorder when you run low.</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1.5" /> Add item</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Package} label="Total items" value={kpis.total} />
        <KpiCard icon={AlertTriangle} label="Low stock" value={kpis.low} tone="amber" />
        <KpiCard icon={XCircle} label="Out of stock" value={kpis.out} tone="red" />
        <KpiCard icon={Truck} label="Reorders pending" value={kpis.pending} tone="blue" />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All items</TabsTrigger>
          <TabsTrigger value="property">By property</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {items.map((it) => {
              const r = rollup(it);
              const propsCount = Object.keys(it.perProperty).length;
              const isLow = r.status !== "ok";
              return (
                <div key={it.id} className="p-4 grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-12 md:col-span-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.category} · {propsCount} {propsCount === 1 ? "property" : "properties"}
                          {r.lowProps > 0 && <> · <span className="text-amber-600">{r.lowProps} low</span></>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-5 space-y-1.5">
                    <StockBar current={r.current} reorderAt={r.reorderAt} max={r.max} />
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                      <span>{r.current}/{r.max} {it.unit}</span>
                      <span>reorder ≤ {r.reorderAt}</span>
                    </div>
                  </div>

                  <div className="col-span-6 md:col-span-1 flex md:justify-center">
                    <StatusPill status={r.status} pending={it.reorderPending} />
                  </div>

                  <div className="col-span-6 md:col-span-2 flex md:justify-end gap-1.5">
                    {isLow ? (
                      <Button size="sm" onClick={() => setReorderItem({ item: it })}>
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Reorder
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => openEdit(it)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="p-12 text-center text-sm text-muted-foreground">No inventory items yet.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="property" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-full sm:w-80">
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allProperties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const lows = items.filter((i) => {
                  const l = i.perProperty[propertyId];
                  return l && l.current <= l.reorderAt;
                });
                if (lows.length === 0) { toast("No low items at this property"); return; }
                lows.forEach((i) => markOrdered(i.id));
                toast.success(`Restocked ${lows.length} item${lows.length === 1 ? "" : "s"} from Amazon`);
              }}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Restock all low items
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {items
              .filter((i) => i.perProperty[propertyId])
              .map((it) => {
                const lvl = it.perProperty[propertyId];
                const s = stockStatus(lvl.current, lvl.reorderAt);
                const isLow = s !== "ok";
                return (
                  <div key={it.id} className="p-4 grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-12 md:col-span-4 min-w-0">
                      <div className="font-medium truncate">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{it.category}</div>
                    </div>
                    <div className="col-span-12 md:col-span-5 space-y-1.5">
                      <StockBar current={lvl.current} reorderAt={lvl.reorderAt} max={lvl.max} />
                      <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>{lvl.current}/{lvl.max} {it.unit}</span>
                        <span>reorder ≤ {lvl.reorderAt}</span>
                      </div>
                    </div>
                    <div className="col-span-6 md:col-span-1 flex md:justify-center">
                      <StatusPill status={s} pending={it.reorderPending} />
                    </div>
                    <div className="col-span-6 md:col-span-2 flex md:justify-end gap-1.5">
                      {isLow ? (
                        <Button size="sm" onClick={() => setReorderItem({ item: it, propertyId })}>
                          <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Reorder
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openEdit(it)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            {items.filter((i) => i.perProperty[propertyId]).length === 0 && (
              <div className="p-12 text-center text-sm text-muted-foreground">No items assigned to this property yet.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AutoReorderDialog
        open={!!reorderItem}
        onOpenChange={(v) => !v && setReorderItem(null)}
        item={reorderItem?.item ?? null}
        propertyId={reorderItem?.propertyId}
        onOrdered={markOrdered}
      />
      <InventoryItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editItem}
        onSave={upsert}
      />
    </div>
  );
};

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone?: "amber" | "red" | "blue" }) {
  const toneClass =
    tone === "amber" ? "text-amber-600" : tone === "red" ? "text-destructive" : tone === "blue" ? "text-sky-600" : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground font-mono">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={cn("mt-2 text-3xl font-bold tracking-tight", toneClass)}>{value}</div>
    </div>
  );
}

function StatusPill({ status, pending }: { status: "ok" | "low" | "out"; pending?: boolean }) {
  if (pending) return <Badge variant="outline" className="text-sky-600 border-sky-300">Pending</Badge>;
  if (status === "out") return <Badge variant="destructive">Out</Badge>;
  if (status === "low") return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Low</Badge>;
  return <Badge variant="secondary">OK</Badge>;
}

export default Inventory;

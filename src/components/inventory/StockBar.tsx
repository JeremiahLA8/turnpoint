import { cn } from "@/lib/utils";

type Props = {
  current: number;
  reorderAt: number;
  max: number;
  showTicks?: boolean;
  className?: string;
};

export function stockStatus(current: number, reorderAt: number) {
  if (current <= 0) return "out" as const;
  if (current <= reorderAt) return "low" as const;
  return "ok" as const;
}

export function StockBar({ current, reorderAt, max, showTicks = true, className }: Props) {
  const pct = Math.max(0, Math.min(100, (current / Math.max(max, 1)) * 100));
  const status = stockStatus(current, reorderAt);
  const fillClass =
    status === "out"
      ? "bg-destructive"
      : status === "low"
      ? "bg-amber-500"
      : pct >= 50
      ? "bg-emerald-500"
      : "bg-amber-500";
  const reorderPct = Math.min(100, (reorderAt / Math.max(max, 1)) * 100);

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all", fillClass)}
          style={{ width: `${pct}%` }}
        />
        {showTicks && (
          <div
            className="absolute top-0 bottom-0 w-px bg-foreground/40"
            style={{ left: `${reorderPct}%` }}
            title={`Reorder at ${reorderAt}`}
          />
        )}
      </div>
    </div>
  );
}

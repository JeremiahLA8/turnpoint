// Small status pill: shows when the cleaner is offline or has changes waiting to
// sync. Hidden entirely when online with an empty queue. Mounted app-wide; it
// also drives the background sync via useOfflineSync.

import { useOfflineSync } from "@/lib/useOfflineSync";
import { CloudOff, RefreshCw, Cloud } from "lucide-react";

export function OfflineQueueIndicator() {
  const { pending, syncing, online } = useOfflineSync();

  if (online && pending === 0) return null;

  const label = !online
    ? pending > 0
      ? `Offline · ${pending} change${pending === 1 ? "" : "s"} waiting`
      : "Offline"
    : syncing
      ? `Syncing ${pending} change${pending === 1 ? "" : "s"}…`
      : `${pending} change${pending === 1 ? "" : "s"} to sync`;

  const Icon = !online ? CloudOff : syncing ? RefreshCw : Cloud;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md ${
        online ? "border-border bg-card text-foreground" : "border-amber-500/40 bg-amber-500/10 text-amber-700"
      }`}
      role="status"
    >
      <Icon className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
      {label}
    </div>
  );
}

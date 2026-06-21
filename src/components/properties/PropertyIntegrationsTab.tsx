import { useState } from "react";
import type { Property } from "@/lib/api/properties";
import { integrationProviders, propertyIntegrations } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug, RefreshCw, Check, ExternalLink, CalendarSync } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Active = { providerId: string; lastSync: string; externalId: string } | null;

export const PropertyIntegrationsTab = ({ property }: { property: Property }) => {
  const { toast } = useToast();

  const initialActive: Active = (() => {
    const first = (propertyIntegrations[property.id] ?? []).find((i) => i.status === "connected");
    return first ? { providerId: first.providerId, lastSync: first.lastSync ?? "—", externalId: first.externalId ?? "" } : null;
  })();

  const [active, setActive] = useState<Active>(initialActive);
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null);
  const [history, setHistory] = useState<{ provider: string; action: string; time: string }[]>(
    initialActive
      ? [{ provider: integrationProviders.find((p) => p.id === initialActive.providerId)?.name ?? "", action: "Calendar synced", time: initialActive.lastSync }]
      : [],
  );

  const doConnect = (id: string, name: string) => {
    setActive({ providerId: id, lastSync: "just now", externalId: `EXT-${id.toUpperCase()}-001` });
    setHistory((h) => [{ provider: name, action: "Connected · calendar imported", time: "just now" }, ...h]);
    toast({ title: `${name} connected`, description: "Calendar is now syncing from this source." });
  };

  const handleConnectClick = (id: string, name: string) => {
    if (active && active.providerId !== id) {
      setPending({ id, name });
      return;
    }
    doConnect(id, name);
  };

  const confirmSwitch = () => {
    if (!pending || !active) return;
    const prev = integrationProviders.find((p) => p.id === active.providerId)?.name ?? "Previous source";
    setHistory((h) => [{ provider: prev, action: "Disconnected", time: "just now" }, ...h]);
    doConnect(pending.id, pending.name);
    setPending(null);
  };

  const disconnect = (name: string) => {
    setActive(null);
    setHistory((h) => [{ provider: name, action: "Disconnected", time: "just now" }, ...h]);
    toast({ title: `${name} disconnected` });
  };

  const sync = (name: string) => {
    if (!active) return;
    setActive({ ...active, lastSync: "just now" });
    setHistory((h) => [{ provider: name, action: "Manual sync", time: "just now" }, ...h]);
    toast({ title: `${name} synced` });
  };

  const pms = integrationProviders.filter((p) => p.category === "PMS");
  const ota = integrationProviders.filter((p) => p.category === "OTA");
  const activeName = active ? integrationProviders.find((p) => p.id === active.providerId)?.name : null;

  return (
    <div className="space-y-5">
      <section className="bg-card border border-border rounded-xl p-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <CalendarSync className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Calendar source</div>
          <div className="text-xs text-muted-foreground">
            Only one integration can be active per property. Calendar data is pulled from the active source.
          </div>
        </div>
        {active ? (
          <Badge className="text-[10px] inline-flex items-center gap-1">
            <Check className="h-3 w-3" /> {activeName}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">No source</Badge>
        )}
      </section>

      <Group
        title="Property Management Systems"
        providers={pms}
        active={active}
        onConnect={handleConnectClick}
        onDisconnect={disconnect}
        onSync={sync}
      />
      <Group
        title="Online Travel Agencies (OTA)"
        providers={ota}
        active={active}
        onConnect={handleConnectClick}
        onDisconnect={disconnect}
        onSync={sync}
      />

      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-bold mb-4">Sync history</h2>
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">No activity yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 text-sm">
                <Badge variant="outline" className="text-[10px]">{h.provider}</Badge>
                <span className="flex-1 min-w-0 truncate">{h.action}</span>
                <span className="text-xs text-muted-foreground font-mono">{h.time}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch calendar source?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeName} is currently the active calendar source for this property. Connecting{" "}
              <span className="font-semibold">{pending?.name}</span> will disconnect {activeName} and start
              pulling calendar data from {pending?.name} instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitch}>Switch source</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Group = ({
  title,
  providers,
  active,
  onConnect,
  onDisconnect,
  onSync,
}: {
  title: string;
  providers: typeof integrationProviders;
  active: Active;
  onConnect: (id: string, name: string) => void;
  onDisconnect: (name: string) => void;
  onSync: (name: string) => void;
}) => (
  <section className="bg-card border border-border rounded-xl p-6">
    <h2 className="font-bold mb-4">{title}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {providers.map((p) => {
        const isActive = active?.providerId === p.id;
        return (
          <div key={p.id} className={cn("border border-border rounded-lg p-4 flex items-start gap-3", isActive && "border-primary/40 bg-primary/5")}>
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
              <Plug className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold">{p.name}</div>
                {isActive ? (
                  <Badge className="text-[10px] inline-flex items-center gap-1"><Check className="h-3 w-3" /> Active</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Not connected</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>
              {isActive && active && (
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  {active.externalId} · last sync {active.lastSync}
                </div>
              )}
              <div className="flex items-center gap-2 mt-3">
                {isActive ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onSync(p.name)}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Sync now
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDisconnect(p.name)}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => onConnect(p.id, p.name)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    {active ? "Switch to this source" : "Connect"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

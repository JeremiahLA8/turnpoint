import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { propertyAssignments, propertyIntegrations, teammates, propertyOwners } from "@/data/mockData";
import { useProperties, propertiesQueryKey, type Property } from "@/lib/api/properties";
import { jobsQueryKey } from "@/lib/api/jobs";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bed, Bath, Maximize, Home, Users, MapPin, ArrowRight, LayoutGrid, List as ListIcon, Plug, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { NewPropertyDialog } from "@/components/properties/NewPropertyDialog";
import { HostawayConnectDialog } from "@/components/HostawayConnectDialog";
import { useToast } from "@/hooks/use-toast";

const Properties = () => {
  const [view, setView] = useState<"list" | "grid">("list");
  const [newOpen, setNewOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: properties, isLoading, error } = useProperties();

  const onSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("hostaway-sync");
      if (error) throw error;
      const p = (data as { properties?: { created: number; updated: number } })?.properties;
      const j = (data as { jobs?: { created: number; updated: number } })?.jobs;
      toast({
        title: "Synced from Hostaway",
        description: `Properties: +${p?.created ?? 0} new, ${p?.updated ?? 0} updated. Jobs: +${j?.created ?? 0} new, ${j?.updated ?? 0} updated.`,
      });
      qc.invalidateQueries({ queryKey: propertiesQueryKey });
      qc.invalidateQueries({ queryKey: jobsQueryKey });
    } catch (e) {
      toast({
        title: "Sync failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const filtered = properties ?? [];

  return (
    <div className="space-y-5 w-full max-w-6xl mx-auto">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setView("list")}
            className={cn(
              "h-9 w-9 inline-flex items-center justify-center hover:bg-muted",
              view === "list" && "bg-muted text-foreground",
            )}
            aria-label="List view"
          >
            <ListIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("grid")}
            className={cn(
              "h-9 w-9 inline-flex items-center justify-center hover:bg-muted border-l border-border",
              view === "grid" && "bg-muted text-foreground",
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            className="rounded-full"
            onClick={() => setConnectOpen(true)}
            title="Connect a Hostaway account by pasting its API key"
          >
            Connect Hostaway
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={onSync}
            disabled={syncing}
            title="Pull listings and upcoming reservations from Hostaway"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing…" : "Sync from Hostaway"}
          </Button>
          <Button className="rounded-full" onClick={() => setNewOpen(true)}>+ New Property</Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {isLoading ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading properties…</span>
        ) : error ? (
          <span className="text-destructive">Failed to load properties: {error.message}</span>
        ) : (
          <>{filtered.length} {filtered.length === 1 ? "property" : "properties"}</>
        )}
      </div>

      <div
        className={cn(
          view === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-3",
        )}
      >
        {filtered.map((p) => {
          const assign = propertyAssignments[p.id];
          const owner = assign?.ownerId ? propertyOwners.find((o) => o.id === assign.ownerId) : null;
          const cleaners = (assign?.cleanerIds ?? []).map((id) => teammates.find((t) => t.id === id)).filter(Boolean);
          const integrations = (propertyIntegrations[p.id] ?? []).filter((i) => i.status === "connected");
          const monogram = p.name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

          return (
            <Link
              key={p.id}
              to={`/properties/${p.id}`}
              className={cn(
                "group block bg-card border border-border rounded-xl overflow-hidden transition-all hover:border-primary/40 hover:shadow-md",
                view === "grid" ? "" : "p-4 flex items-stretch gap-4 min-w-0",
              )}
            >
              {view === "grid" ? (
                <>
                  <div className={cn("relative h-32 flex items-center justify-center", p.color)}>
                    <span className="text-3xl font-bold tracking-tight">{monogram}</span>
                    <span className="absolute top-2 right-2 text-[10px] font-mono bg-background/80 backdrop-blur px-2 py-0.5 rounded-full">
                      {p.completion}%
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {p.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{p.address}</span>
                    </div>
                    <Stats p={p} />
                    <Footer owner={owner?.name} cleaners={cleaners.map((c) => c!.name)} integrations={integrations.length} />
                  </div>
                </>
              ) : (
                <>
                  <div className={cn("w-24 h-24 rounded-lg flex items-center justify-center shrink-0", p.color)}>
                    <span className="text-2xl font-bold tracking-tight">{monogram}</span>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold truncate group-hover:text-primary transition-colors">{p.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{p.address}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{p.completion}%</Badge>
                    </div>
                    <div className="mt-2"><Stats p={p} /></div>
                    <div className="mt-auto pt-3"><Footer owner={owner?.name} cleaners={cleaners.map((c) => c!.name)} integrations={integrations.length} withArrow /></div>
                  </div>
                </>
              )}
            </Link>
          );
        })}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No properties yet. Click <span className="font-semibold">+ New Property</span> to add one.
          </div>
        )}
      </div>
      <NewPropertyDialog open={newOpen} onOpenChange={setNewOpen} />
      <HostawayConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
    </div>
  );
};

const Stats = ({ p }: { p: Property }) => (
  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-mono">
    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {p.guests}</span>
    <span className="inline-flex items-center gap-1"><Bed className="h-3 w-3" /> {p.beds}</span>
    <span className="inline-flex items-center gap-1"><Bath className="h-3 w-3" /> {p.baths}</span>
    {p.sqft > 0 && (
      <span className="inline-flex items-center gap-1"><Maximize className="h-3 w-3" /> {p.sqft} sq.ft.</span>
    )}
  </div>
);

const Footer = ({
  owner,
  cleaners,
  integrations,
  withArrow,
}: {
  owner?: string;
  cleaners: string[];
  integrations: number;
  withArrow?: boolean;
}) => (
  <div className="flex items-center justify-between gap-2 text-xs">
    <div className="flex items-center gap-3 min-w-0 flex-1">
      {owner && (
        <span className="inline-flex items-center gap-1 text-muted-foreground truncate">
          <Home className="h-3 w-3 shrink-0" /> <span className="truncate">{owner}</span>
        </span>
      )}
      {cleaners.length > 0 && (
        <span className="inline-flex items-center gap-1 text-muted-foreground truncate">
          <Users className="h-3 w-3 shrink-0" /> <span className="truncate">{cleaners[0]}{cleaners.length > 1 ? ` +${cleaners.length - 1}` : ""}</span>
        </span>
      )}
      {integrations > 0 && (
        <span className="inline-flex items-center gap-1 text-primary">
          <Plug className="h-3 w-3" /> {integrations}
        </span>
      )}
    </div>
    {withArrow && (
      <span className="inline-flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        Open <ArrowRight className="h-3 w-3" />
      </span>
    )}
  </div>
);

export default Properties;

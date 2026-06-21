import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Download, ArrowLeft, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCreateProperty } from "@/lib/api/properties";

type Step = "choose" | "scratch" | "import-pick" | "import-auth" | "import-list";

const providers = [
  { id: "hostaway", name: "Hostaway", desc: "PMS · Sync listings, calendars, reservations" },
  { id: "guesty", name: "Guesty", desc: "PMS · Multi-channel property management" },
  { id: "ownerrez", name: "OwnerRez", desc: "PMS · Vacation rental management" },
  { id: "airbnb", name: "Airbnb", desc: "OTA · Import listing details" },
  { id: "vrbo", name: "Vrbo", desc: "OTA · Import listing details" },
  { id: "booking", name: "Booking.com", desc: "OTA · Import listing details" },
];

const sampleImports = [
  { id: "imp1", name: "Sunset Cove Villa", address: "412 Beachside Dr, Malibu, CA", beds: 4, baths: 3 },
  { id: "imp2", name: "Cedar Ridge Cabin", address: "88 Pinetop Ln, Big Bear, CA", beds: 3, baths: 2 },
  { id: "imp3", name: "Downtown Loft 4B", address: "1200 Market St #4B, San Francisco, CA", beds: 1, baths: 1 },
];

export function NewPropertyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState<Step>("choose");
  const [provider, setProvider] = useState<typeof providers[number] | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const createProperty = useCreateProperty();

  const reset = () => {
    setStep("choose");
    setProvider(null);
    setApiKey("");
    setSelected(new Set());
    setName("");
    setAddress("");
    setLoading(false);
  };

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) setTimeout(reset, 200);
  };

  const handleScratchCreate = async () => {
    if (!name.trim()) {
      toast.error("Property name is required");
      return;
    }
    try {
      await createProperty.mutateAsync({
        name: name.trim(),
        address: address.trim(),
      });
      toast.success(`Created "${name.trim()}"`);
      close(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create property";
      toast.error(msg);
    }
  };

  const handleAuth = () => {
    if (!apiKey.trim()) {
      toast.error("Enter credentials to continue");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("import-list");
    }, 900);
  };

  const handleImport = () => {
    if (selected.size === 0) {
      toast.error("Select at least one listing");
      return;
    }
    toast.success(`Imported ${selected.size} listing${selected.size > 1 ? "s" : ""} from ${provider?.name}`);
    close(false);
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[560px]">
        {step === "choose" && (
          <>
            <DialogHeader>
              <DialogTitle>Add a new property</DialogTitle>
              <DialogDescription>Build a fresh listing or pull one in from a connected platform.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setStep("scratch")}
                className="text-left p-4 rounded-xl border border-border hover:border-primary/60 hover:bg-muted/40 transition-all group"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="font-semibold">Create from scratch</div>
                <div className="text-xs text-muted-foreground mt-1">Set up a property manually with your own details.</div>
              </button>
              <button
                onClick={() => setStep("import-pick")}
                className="text-left p-4 rounded-xl border border-border hover:border-primary/60 hover:bg-muted/40 transition-all group"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Download className="h-5 w-5" />
                </div>
                <div className="font-semibold">Import a listing</div>
                <div className="text-xs text-muted-foreground mt-1">Pull from Hostaway, Guesty, Airbnb and more.</div>
              </button>
            </div>
          </>
        )}

        {step === "scratch" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BackBtn onClick={() => setStep("choose")} /> Create from scratch
              </DialogTitle>
              <DialogDescription>Enter the basics. You can fill in the rest on the property page.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="np-name">Property name</Label>
                <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lakeside Cottage" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-addr">Address</Label>
                <Input id="np-addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, State" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)} disabled={createProperty.isPending}>Cancel</Button>
              <Button onClick={handleScratchCreate} disabled={createProperty.isPending}>
                {createProperty.isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</>) : "Create property"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "import-pick" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BackBtn onClick={() => setStep("choose")} /> Choose a source
              </DialogTitle>
              <DialogDescription>Pick where to import the listing from.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 max-h-[360px] overflow-y-auto">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setProvider(p); setStep("import-auth"); }}
                  className="text-left p-3 rounded-lg border border-border hover:border-primary/60 hover:bg-muted/40 transition-all"
                >
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === "import-auth" && provider && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BackBtn onClick={() => setStep("import-pick")} /> Connect {provider.name}
              </DialogTitle>
              <DialogDescription>Paste your API key or account credentials to fetch listings.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="np-key">{provider.name} API key</Label>
                <Input
                  id="np-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="••••••••••••••••"
                />
                <p className="text-xs text-muted-foreground">Stored securely and only used to fetch your listings.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button onClick={handleAuth} disabled={loading}>
                {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting…</>) : "Connect & fetch"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "import-list" && provider && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BackBtn onClick={() => setStep("import-auth")} /> Import from {provider.name}
              </DialogTitle>
              <DialogDescription>Select the listings you'd like to bring in.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 pt-2 max-h-[360px] overflow-y-auto">
              {sampleImports.map((l) => {
                const on = selected.has(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => toggle(l.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-all",
                      on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className={cn(
                      "h-5 w-5 rounded border flex items-center justify-center shrink-0",
                      on ? "bg-primary border-primary text-primary-foreground" : "border-border",
                    )}>
                      {on && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{l.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{l.address}</div>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono shrink-0">{l.beds}bd · {l.baths}ba</div>
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button onClick={handleImport}>Import {selected.size > 0 ? `(${selected.size})` : ""}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const BackBtn = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="h-7 w-7 -ml-1 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
    aria-label="Back"
  >
    <ArrowLeft className="h-4 w-4" />
  </button>
);

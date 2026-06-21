import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { properties, currentUser, type Problem } from "@/data/mockData";
import { useProblems, problemsStore } from "@/lib/problemsStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Search, Clock, ImagePlus, X, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const tabs = [
  { key: "unresolved", label: "Unresolved" },
  { key: "solved", label: "Solved" },
] as const;

type TabKey = typeof tabs[number]["key"];

const PropertyProblems = () => {
  const [tab, setTab] = useState<TabKey>("unresolved");
  const items = useProblems();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  // Report form state
  const [propertyName, setPropertyName] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((p) => p.status === tab);
  const selected = items.find((p) => p.id === selectedId) ?? null;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const urls = Array.from(files).map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...urls]);
  };

  const resetForm = () => {
    setPropertyName(""); setTitle(""); setDescription(""); setImages([]); setQuoteAmount(""); setQuoteNote("");
  };

  const submitReport = () => {
    if (!title.trim() || !propertyName || !description.trim()) {
      toast({ title: "Missing info", description: "Property, title and description are required." });
      return;
    }
    const now = new Date();
    const newProblem: Problem = {
      id: `pr-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      images,
      quote: quoteAmount ? { amount: Number(quoteAmount), note: quoteNote.trim() } : undefined,
      property: propertyName,
      reporter: currentUser.name,
      date: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      status: "unresolved",
      ticketId: String(Math.floor(1000000 + Math.random() * 9000000)),
      color: "bg-primary",
    };
    problemsStore.add(newProblem);
    setReportOpen(false);
    resetForm();
    setTab("unresolved");
    toast({ title: "Problem reported", description: "It's now visible in Unresolved." });
  };

  const markResolved = (id: string) => {
    problemsStore.setStatus(id, "solved");
    setSelectedId(null);
    toast({ title: "Marked as resolved" });
  };

  return (
    <div className="space-y-4 w-full max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search Problems" className="pl-9" />
        </div>
        <Button variant="outline"><Filter className="h-4 w-4 mr-1" /> Filters</Button>
        <div className="sm:ml-auto">
          <Button className="rounded-full" onClick={() => setReportOpen(true)}>Report Problem</Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-2 border-b border-border">
          {tabs.map((t) => {
            const count = items.filter((p) => p.status === t.key).length;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`min-w-0 p-3 sm:p-4 text-center font-medium border-b-2 ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t.label}
                {count > 0 && <span className="ml-2 text-xs font-mono bg-destructive text-destructive-foreground rounded-full px-2 py-0.5">{count}</span>}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">No problems in this tab</div>
        ) : (
          <div className="divide-y divide-border">
            {Array.from(
              filtered.reduce((map, p) => {
                const arr = map.get(p.property) ?? [];
                arr.push(p);
                map.set(p.property, arr);
                return map;
              }, new Map<string, Problem[]>())
            ).map(([propName, group]) => (
              <div key={propName}>
                <div className="px-4 py-2 bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                  <span className="text-primary normal-case tracking-normal text-sm">{propName}</span>
                  <span>{group.length} problem{group.length > 1 ? "s" : ""}</span>
                </div>
                <div className="divide-y divide-border">
                  {group.map((p) => (
                    <button key={p.id} onClick={() => setSelectedId(p.id)} className="w-full text-left flex hover:bg-muted/40 transition-colors">
                      <div className={`w-1.5 ${p.color}`} />
                      <div className="flex-1 p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold">{p.title}</span>
                          {p.images.length > 0 && (
                            <span className="text-xs text-muted-foreground">· {p.images.length} photo{p.images.length > 1 ? "s" : ""}</span>
                          )}
                          {p.quote && (
                            <span className="text-xs font-medium text-foreground bg-muted px-2 py-0.5 rounded-full">Quote: ${p.quote.amount}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
                          <Clock className="h-3 w-3" /> {p.date} · {p.time}
                          <span>· Reporter: <span className="text-primary">{p.reporter}</span></span>
                          <span>· #<span className="font-mono">{p.ticketId}</span></span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  <span className="text-primary">{selected.property}</span> · #{selected.ticketId}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <Clock className="h-3 w-3" /> {selected.date} · {selected.time}
                  <span>· Reported by <span className="text-primary">{selected.reporter}</span></span>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Description</h4>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">{selected.description || "No description provided."}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Photos</h4>
                  {selected.images.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No photos uploaded.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {selected.images.map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg border border-border">
                          <img src={src} alt={`Problem photo ${i + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Cleaner's quote to fix</h4>
                  {selected.quote ? (
                    <div className="rounded-lg border border-border p-3 space-y-1">
                      <div className="text-lg font-bold">${selected.quote.amount.toFixed(2)}</div>
                      {selected.quote.note && <p className="text-sm text-muted-foreground">{selected.quote.note}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No quote submitted.</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {selected.status === "unresolved" && (
                    <Button className="w-full" onClick={() => markResolved(selected.id)}>
                      <Check className="h-4 w-4 mr-2" /> Mark as resolved
                    </Button>
                  )}
                  <Button asChild variant="outline" className="w-full">
                    <Link to={`/property-problems/${selected.id}`}>Open full page</Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={(o) => { setReportOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report a problem</DialogTitle>
            <DialogDescription>Submit issues found while cleaning. Photos and a quote help managers act faster.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Property / project</Label>
              <Select value={propertyName} onValueChange={setPropertyName}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Broken blind in primary bedroom" maxLength={120} />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you find?" rows={4} maxLength={1000} />
            </div>

            <div className="space-y-2">
              <Label>Photos</Label>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4 mr-2" /> Add photos
              </Button>
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {images.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                      <img src={src} alt={`upload ${i + 1}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 bg-background/80 rounded-full p-1 hover:bg-background">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <Label>Quote to fix it (optional)</Label>
              <p className="text-xs text-muted-foreground">If you or your handyman can fix it, share an estimate.</p>
              <Input type="number" min="0" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} placeholder="Amount in $" />
              <Textarea value={quoteNote} onChange={(e) => setQuoteNote(e.target.value)} placeholder="Notes about the quote" rows={2} maxLength={300} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={submitReport}>Submit report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyProblems;

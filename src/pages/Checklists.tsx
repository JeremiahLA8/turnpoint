import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ListChecks,
  Upload,
  Sparkles,
  Plus,
  X,
  FileText,
  Loader2,
  Save,
  ArrowLeft,
  Trash2,
  Search,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useChecklistTemplates,
  useChecklistTemplate,
  useSaveChecklist,
  useDeleteChecklist,
  itemsToSections,
  type ChecklistSection,
} from "@/lib/api/checklists";

const SECTION_NAMES = [
  "General",
  "Bedrooms",
  "Bathrooms",
  "Kitchen",
  "Living areas",
  "Outdoor",
  "Amenities",
  "Laundry",
] as const;

const emptyForm = (): ChecklistSection[] =>
  SECTION_NAMES.map((name) => ({ name, items: [] }));

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });

/* ---------------------------------------------------------------- */
/* List page                                                        */
/* ---------------------------------------------------------------- */
export const MyChecklists = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const templatesQuery = useChecklistTemplates();
  const deleteChecklist = useDeleteChecklist();
  const [query, setQuery] = useState("");

  const items = templatesQuery.data ?? [];
  const filtered = useMemo(
    () =>
      items.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [items, query],
  );

  const remove = async (id: string) => {
    try {
      await deleteChecklist.mutateAsync(id);
      toast({ title: "Checklist deleted" });
    } catch (e) {
      toast({
        title: "Could not delete",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Checklists</h1>
          <p className="text-muted-foreground mt-1">
            Your saved property checklists. Build a new one from scratch or with AI.
          </p>
        </div>
        <Button onClick={() => navigate("/checklists/new")}>
          <Plus className="h-4 w-4" /> Build checklist
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search checklists…"
          className="pl-9"
        />
      </div>

      {templatesQuery.isLoading ? (
        <Card className="p-12 border-dashed text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Loading…</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 border-dashed text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">
            {items.length === 0 ? "No checklists yet" : "No matches"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length === 0
              ? "Create your first checklist — upload a PDF, image, or paste text and AI will build it."
              : "Try a different search term."}
          </p>
          {items.length === 0 && (
            <Button className="mt-4" onClick={() => navigate("/checklists/new")}>
              <Plus className="h-4 w-4" /> Build checklist
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const total = c.items.length;
            const sectionsWithItems = new Set(c.items.map((i) => i.section)).size;
            return (
              <Card key={c.id} className="p-5 hover:shadow-md transition-shadow group">
                <Link to={`/checklists/${c.id}`} className="block">
                  <div className="flex items-center gap-2 mb-3">
                    <ListChecks className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold truncate">{c.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-3 text-sm text-muted-foreground">
                    <span><span className="font-bold text-foreground">{total}</span> tasks</span>
                    <span>·</span>
                    <span>{sectionsWithItems} sections</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-3">
                    Updated {new Date(c.updated_at).toLocaleDateString()}
                  </div>
                </Link>
                <div className="flex justify-end mt-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                    onClick={() => remove(c.id)}
                    disabled={deleteChecklist.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------- */
/* Builder page                                                     */
/* ---------------------------------------------------------------- */
export const ChecklistBuilder = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const existingQuery = useChecklistTemplate(id);
  const saveChecklist = useSaveChecklist();
  const [name, setName] = useState("Untitled checklist");
  const [sections, setSections] = useState<ChecklistSection[]>(emptyForm);
  const [bulkText, setBulkText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [hydrated, setHydrated] = useState(!id);

  // Hydrate the form from the existing template once it loads.
  useEffect(() => {
    if (!id || hydrated) return;
    if (existingQuery.isLoading) return;
    if (!existingQuery.data) {
      toast({ title: "Checklist not found", variant: "destructive" });
      navigate("/checklists", { replace: true });
      return;
    }
    setName(existingQuery.data.name);
    const fromDb = itemsToSections(existingQuery.data.items);
    setSections(
      SECTION_NAMES.map((sn) => {
        const found = fromDb.find((s) => s.name === sn);
        return { name: sn, items: found?.items ?? [] };
      }),
    );
    setHydrated(true);
  }, [id, existingQuery.isLoading, existingQuery.data, hydrated, navigate, toast]);

  const totalItems = sections.reduce((n, s) => n + s.items.length, 0);

  const updateItem = (si: number, ii: number, val: string) =>
    setSections((s) =>
      s.map((sec, i) => (i === si ? { ...sec, items: sec.items.map((it, j) => (j === ii ? val : it)) } : sec)),
    );

  const removeItem = (si: number, ii: number) =>
    setSections((s) =>
      s.map((sec, i) => (i === si ? { ...sec, items: sec.items.filter((_, j) => j !== ii) } : sec)),
    );

  const addItem = (si: number) =>
    setSections((s) =>
      s.map((sec, i) => (i === si ? { ...sec, items: [...sec.items, ""] } : sec)),
    );

  const handleParse = async () => {
    if (!bulkText.trim() && !file) {
      toast({ title: "Add input first", description: "Paste text or attach a file.", variant: "destructive" });
      return;
    }
    setParsing(true);
    try {
      const payload: Record<string, unknown> = {};
      if (bulkText.trim()) payload.text = bulkText.trim();
      if (file) {
        payload.fileBase64 = await fileToBase64(file);
        payload.mimeType = file.type;
        payload.fileName = file.name;
      }

      const { data, error } = await supabase.functions.invoke("parse-checklist", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const incoming = (data?.sections ?? []) as ChecklistSection[];
      const merged = SECTION_NAMES.map((sn) => {
        const found = incoming.find((s) => s.name === sn);
        return { name: sn, items: found?.items?.filter(Boolean) ?? [] };
      });
      setSections(merged);
      if (data?.name && typeof data.name === "string") setName(data.name);

      toast({
        title: "Checklist parsed",
        description: `Filled ${merged.reduce((n, s) => n + s.items.length, 0)} items across ${merged.filter((s) => s.items.length).length} sections.`,
      });
      setBulkText("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (e: any) {
      toast({
        title: "Could not parse",
        description: e?.message ?? "Try again with cleaner input.",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    try {
      const saved = await saveChecklist.mutateAsync({
        id: id || undefined,
        name: name.trim() || "Untitled checklist",
        sections,
      });
      toast({
        title: "Checklist saved",
        description: `${saved.name} · ${totalItems} tasks`,
      });
      navigate("/checklists");
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    }
  };

  if (id && !hydrated) {
    return (
      <div className="space-y-6 w-full max-w-5xl mx-auto">
        <p className="text-sm text-muted-foreground">Loading checklist…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/checklists")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {id ? "Edit checklist" : "Build checklist"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Build a property checklist from scratch, or let AI fill it in from a file or pasted text.
          </p>
        </div>
      </div>

      {/* AI Import */}
      <Card className="p-6 border-dashed">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Import with AI</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Paste a checklist
            </label>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Paste your checklist here — any format. AI will sort tasks into sections."
              className="mt-2 min-h-[140px]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Or upload a file
            </label>
            <div className="mt-2">
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="w-full min-h-[140px] rounded-md border border-dashed border-border hover:border-primary/50 hover:bg-accent/30 transition-colors flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                {file ? (
                  <>
                    <FileText className="h-6 w-6 text-primary" />
                    <span className="font-medium text-foreground">{file.name}</span>
                    <span className="text-xs">{(file.size / 1024).toFixed(0)} KB · click to change</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6" />
                    <span>Click to upload PDF, JPG, or PNG</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={handleParse} disabled={parsing}>
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Fill checklist with AI
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Form */}
      <Card className="p-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Checklist name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 text-lg font-semibold border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold">{totalItems}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">tasks</div>
          </div>
        </div>

        <div className="space-y-5">
          {sections.map((sec, si) => (
            <section key={sec.name} className="border border-border rounded-lg">
              <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">{sec.name}</h3>
                  <span className="text-xs font-mono text-muted-foreground">
                    {sec.items.length}
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => addItem(si)}>
                  <Plus className="h-4 w-4" /> Add task
                </Button>
              </header>

              <div className="p-3 space-y-2">
                {sec.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    No tasks yet.
                  </p>
                ) : (
                  sec.items.map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2 group">
                      <span className="text-xs font-mono text-muted-foreground w-6 text-right">
                        {ii + 1}.
                      </span>
                      <Input
                        value={item}
                        onChange={(e) => updateItem(si, ii, e.target.value)}
                        placeholder="Task description"
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                        onClick={() => removeItem(si, ii)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={saveChecklist.isPending}>
            {saveChecklist.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveChecklist.isPending ? "Saving…" : "Save checklist"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

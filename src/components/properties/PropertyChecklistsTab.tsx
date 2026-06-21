import { Link } from "react-router-dom";
import type { PropertyAssignments } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Star, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProperty, useUpdateProperty } from "@/lib/api/properties";
import { useChecklistTemplates } from "@/lib/api/checklists";
import { useToast } from "@/hooks/use-toast";

// Manager-facing tab for picking the default checklist template that
// applies to all cleaning jobs at this property. The choice is persisted
// directly to `properties.checklist_template_id`.
//
// The legacy mock "Checklists" and "Inventory lists" sections that lived
// here have been removed — they pointed at `popularChecklists` and
// `inventoryLists` from mockData and didn't actually persist anywhere.

export const PropertyChecklistsTab = ({
  propertyId,
}: {
  propertyId: string;
  // Kept on the signature for back-compat; not used now that mock sections
  // are gone. PropertyDetail still passes it.
  assignments?: PropertyAssignments;
}) => {
  const { toast } = useToast();
  const propertyQuery = useProperty(propertyId);
  const templatesQuery = useChecklistTemplates();
  const updateProperty = useUpdateProperty();

  const myChecklists = templatesQuery.data ?? [];
  const defaultId = propertyQuery.data?.checklist_template_id ?? null;
  const defaultChecklist = myChecklists.find((c) => c.id === defaultId) ?? null;

  const onPickDefault = async (val: string) => {
    const next = val === "__none__" ? null : val;
    try {
      await updateProperty.mutateAsync({
        id: propertyId,
        patch: { checklist_template_id: next },
      });
      const c = myChecklists.find((x) => x.id === next);
      toast({
        title: next ? "Default checklist set" : "Default cleared",
        description: c ? c.name : undefined,
      });
    } catch (e) {
      toast({
        title: "Could not update default",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-5">
      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-bold inline-flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" /> Default property checklist
          </h2>
          {myChecklists.length > 0 ? (
            <Select value={defaultId ?? "__none__"} onValueChange={onPickDefault}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Pick a checklist" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No default</SelectItem>
                {myChecklists.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/checklists/new"><Plus className="h-4 w-4" /> Build a checklist</Link>
            </Button>
          )}
        </div>
        {defaultChecklist ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="min-w-0">
              <div className="font-medium truncate">{defaultChecklist.name}</div>
              <div className="text-xs text-muted-foreground">
                {defaultChecklist.items.length} tasks · used by default for all cleaning jobs at this property
              </div>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to={`/checklists/${defaultChecklist.id}`}>Open</Link>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No default set. Pick one of your checklists to use it automatically for cleaning jobs at this property.
          </p>
        )}
      </section>
    </div>
  );
};

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useChecklistTemplate,
  useJobChecklistCompletions,
  useToggleChecklistItem,
} from "@/lib/api/checklists";

// Renders the property's checklist on the technician job sheet.
// Each item shows a checkbox; toggling persists immediately via
// useToggleChecklistItem (with optimistic update for snappy UX).
//
// If `readOnly` is true, the checkboxes still reflect state but tap-to-toggle
// is disabled — used when the job is already completed/cancelled.

export type ChecklistDisplayProps = {
  jobId: string;
  templateId: string | null;
  readOnly?: boolean;
};

export const ChecklistDisplay = ({ jobId, templateId, readOnly = false }: ChecklistDisplayProps) => {
  const templateQuery = useChecklistTemplate(templateId ?? undefined);
  const completionsQuery = useJobChecklistCompletions(jobId);
  const toggleItem = useToggleChecklistItem();

  const completedIds = useMemo(() => {
    return new Set((completionsQuery.data ?? []).map((c) => c.item_id));
  }, [completionsQuery.data]);

  if (!templateId) {
    return (
      <p className="text-xs text-muted-foreground">
        No checklist assigned to this property yet. Your manager can pick one in Property settings.
      </p>
    );
  }

  if (templateQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading checklist…
      </div>
    );
  }

  const template = templateQuery.data;
  if (!template || template.items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        The assigned checklist is empty.
      </p>
    );
  }

  // Group items by section, preserving the position order.
  const sorted = [...template.items].sort((a, b) => a.position - b.position);
  const sections = new Map<string, typeof sorted>();
  for (const item of sorted) {
    if (!sections.has(item.section)) sections.set(item.section, []);
    sections.get(item.section)!.push(item);
  }

  return (
    <div className="space-y-4">
      {[...sections.entries()].map(([sectionName, items]) => (
        <div key={sectionName} className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {sectionName}
          </div>
          <ul className="space-y-1.5">
            {items.map((item) => {
              const checked = completedIds.has(item.id);
              return (
                <li key={item.id} className="flex items-start gap-2">
                  <Checkbox
                    id={`item-${item.id}`}
                    checked={checked}
                    disabled={readOnly || toggleItem.isPending}
                    onCheckedChange={(v) =>
                      toggleItem.mutate({
                        jobId,
                        itemId: item.id,
                        checked: v === true,
                      })
                    }
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`item-${item.id}`}
                    className={
                      "text-sm leading-snug cursor-pointer select-none " +
                      (checked ? "line-through text-muted-foreground" : "")
                    }
                  >
                    {item.label}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

export function useChecklistProgress(jobId: string, templateId: string | null) {
  const templateQuery = useChecklistTemplate(templateId ?? undefined);
  const completionsQuery = useJobChecklistCompletions(jobId);

  const total = templateQuery.data?.items.length ?? 0;
  const done = completionsQuery.data?.length ?? 0;
  return {
    total,
    done,
    ratio: total === 0 ? 1 : done / total,
    loading: templateQuery.isLoading || completionsQuery.isLoading,
  };
}

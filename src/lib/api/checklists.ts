// Phase 6 — checklist API hooks.
//
// Three concerns:
//   1. Templates (and their items) — managed by admin/manager. Created
//      either via manual form or via the parse-checklist AI flow.
//   2. Property → template assignment — a column on properties.
//   3. Per-job completions — toggled by the cleaner while working.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { PERSIST_GC_TIME } from "@/lib/queryPersist";

export type ChecklistTemplate = Tables<"checklist_templates">;
export type ChecklistItem = Tables<"checklist_items">;
export type JobChecklistCompletion = Tables<"job_checklist_completions">;

export type ChecklistSection = { name: string; items: string[] };
export type ChecklistTemplateWithItems = ChecklistTemplate & {
  items: ChecklistItem[];
};

export const templatesQueryKey = ["checklist_templates"] as const;
export const templateQueryKey = (id: string) =>
  ["checklist_templates", id] as const;
export const jobCompletionsQueryKey = (jobId: string) =>
  ["job_checklist_completions", jobId] as const;

export function totalItems(t: ChecklistTemplateWithItems): number {
  return t.items.length;
}

export function itemsToSections(items: ChecklistItem[]): ChecklistSection[] {
  const map = new Map<string, string[]>();
  for (const it of [...items].sort((a, b) => a.position - b.position)) {
    if (!map.has(it.section)) map.set(it.section, []);
    map.get(it.section)!.push(it.label);
  }
  return [...map.entries()].map(([name, labels]) => ({ name, items: labels }));
}

// ============================================================================
// Templates list / detail
// ============================================================================

export function useChecklistTemplates() {
  return useQuery({
    queryKey: templatesQueryKey,
    gcTime: PERSIST_GC_TIME,
    queryFn: async (): Promise<ChecklistTemplateWithItems[]> => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*, items:checklist_items(*)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChecklistTemplateWithItems[];
    },
  });
}

export function useChecklistTemplate(id: string | undefined) {
  return useQuery({
    queryKey: templateQueryKey(id ?? ""),
    enabled: !!id,
    gcTime: PERSIST_GC_TIME,
    queryFn: async (): Promise<ChecklistTemplateWithItems | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*, items:checklist_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as ChecklistTemplateWithItems | null) ?? null;
    },
  });
}

// ============================================================================
// Templates CRUD — we always replace the items array on save (small N).
// ============================================================================

export type SaveChecklistInput = {
  id?: string;
  name: string;
  sections: ChecklistSection[];
};

export function useSaveChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveChecklistInput): Promise<ChecklistTemplate> => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      let templateId = input.id;

      if (templateId) {
        // Update the template name; touch updated_at.
        const { error: updErr } = await supabase
          .from("checklist_templates")
          .update({ name: input.name })
          .eq("id", templateId);
        if (updErr) throw updErr;
        // Wipe items, we'll re-insert.
        const { error: delErr } = await supabase
          .from("checklist_items")
          .delete()
          .eq("template_id", templateId);
        if (delErr) throw delErr;
      } else {
        const { data: created, error: insErr } = await supabase
          .from("checklist_templates")
          .insert({ name: input.name, created_by: userId })
          .select()
          .single();
        if (insErr) throw insErr;
        templateId = created.id;
      }

      // Flatten sections → items with stable positions.
      const rows: { template_id: string; section: string; label: string; position: number }[] = [];
      let pos = 0;
      for (const section of input.sections) {
        for (const label of section.items) {
          const trimmed = label.trim();
          if (!trimmed) continue;
          rows.push({
            template_id: templateId,
            section: section.name,
            label: trimmed,
            position: pos++,
          });
        }
      }
      if (rows.length > 0) {
        const { error: itemsErr } = await supabase
          .from("checklist_items")
          .insert(rows);
        if (itemsErr) throw itemsErr;
      }

      const { data: final, error: getErr } = await supabase
        .from("checklist_templates")
        .select("*")
        .eq("id", templateId)
        .single();
      if (getErr) throw getErr;
      return final;
    },
    onSuccess: (template) => {
      qc.invalidateQueries({ queryKey: templatesQueryKey });
      qc.invalidateQueries({ queryKey: templateQueryKey(template.id) });
    },
  });
}

export function useDeleteChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("checklist_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templatesQueryKey });
    },
  });
}

// ============================================================================
// Per-job completions
// ============================================================================

export function useJobChecklistCompletions(jobId: string | undefined) {
  return useQuery({
    queryKey: jobCompletionsQueryKey(jobId ?? ""),
    enabled: !!jobId,
    gcTime: PERSIST_GC_TIME,
    queryFn: async (): Promise<JobChecklistCompletion[]> => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("job_checklist_completions")
        .select("*")
        .eq("job_id", jobId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      itemId,
      checked,
    }: {
      jobId: string;
      itemId: string;
      checked: boolean;
    }): Promise<void> => {
      if (checked) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) throw new Error("Not signed in");
        const { error } = await supabase
          .from("job_checklist_completions")
          .upsert(
            { job_id: jobId, item_id: itemId, completed_by: userId },
            { onConflict: "job_id,item_id", ignoreDuplicates: true },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("job_checklist_completions")
          .delete()
          .eq("job_id", jobId)
          .eq("item_id", itemId);
        if (error) throw error;
      }
    },
    onMutate: async ({ jobId, itemId, checked }) => {
      await qc.cancelQueries({ queryKey: jobCompletionsQueryKey(jobId) });
      const prev = qc.getQueryData<JobChecklistCompletion[]>(
        jobCompletionsQueryKey(jobId),
      );
      qc.setQueryData<JobChecklistCompletion[]>(
        jobCompletionsQueryKey(jobId),
        (cur) => {
          const list = cur ?? [];
          if (checked) {
            if (list.some((c) => c.item_id === itemId)) return list;
            return [
              ...list,
              {
                id: `optimistic-${itemId}`,
                job_id: jobId,
                item_id: itemId,
                completed_by: null,
                completed_at: new Date().toISOString(),
              },
            ];
          }
          return list.filter((c) => c.item_id !== itemId);
        },
      );
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(jobCompletionsQueryKey(vars.jobId), ctx.prev);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: jobCompletionsQueryKey(vars.jobId) });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { PERSIST_GC_TIME } from "@/lib/queryPersist";

export type Property = Tables<"properties">;
export type PropertyInsert = TablesInsert<"properties">;
export type PropertyUpdate = TablesUpdate<"properties">;

export const propertiesQueryKey = ["properties"] as const;

export function useProperties() {
  return useQuery({
    queryKey: propertiesQueryKey,
    gcTime: PERSIST_GC_TIME,
    queryFn: async (): Promise<Property[]> => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: [...propertiesQueryKey, id],
    enabled: !!id,
    gcTime: PERSIST_GC_TIME,
    queryFn: async (): Promise<Property | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PropertyInsert): Promise<Property> => {
      const { data, error } = await supabase
        .from("properties")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: propertiesQueryKey });
    },
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: PropertyUpdate;
    }): Promise<Property> => {
      const { data, error } = await supabase
        .from("properties")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: propertiesQueryKey });
      qc.invalidateQueries({ queryKey: [...propertiesQueryKey, vars.id] });
    },
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: propertiesQueryKey });
    },
  });
}

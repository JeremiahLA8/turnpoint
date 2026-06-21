import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Cleaner = { id: string; full_name: string | null };

export const cleanersQueryKey = ["cleaners"] as const;

export function useCleaners() {
  return useQuery({
    queryKey: cleanersQueryKey,
    queryFn: async (): Promise<Cleaner[]> => {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "technician");
      if (rolesErr) throw rolesErr;
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      if (profErr) throw profErr;
      return (profiles ?? [])
        .slice()
        .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    },
  });
}

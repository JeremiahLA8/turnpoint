import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PhotoAssessment = Tables<"job_photo_assessments">;
export type AssessmentIssue = { photo: number; issue: string };

export const assessmentQueryKey = (jobId: string) => ["job_photo_assessment", jobId] as const;

// The stored AI assessment for a job (null until one is run).
export function useJobAssessment(jobId: string | undefined) {
  return useQuery({
    queryKey: assessmentQueryKey(jobId ?? ""),
    enabled: !!jobId,
    queryFn: async (): Promise<PhotoAssessment | null> => {
      const { data, error } = await supabase
        .from("job_photo_assessments")
        .select("*")
        .eq("job_id", jobId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// Run (or re-run) the AI quality check on a job's after-photos.
export function useAssessPhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string): Promise<PhotoAssessment> => {
      const { data, error } = await supabase.functions.invoke("assess-clean-photos", { body: { job_id: jobId } });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || "Couldn't assess photos");
      return data.assessment as PhotoAssessment;
    },
    onSuccess: (_res, jobId) => qc.invalidateQueries({ queryKey: assessmentQueryKey(jobId) }),
  });
}

export const issuesOf = (a: PhotoAssessment | null | undefined): AssessmentIssue[] =>
  Array.isArray(a?.issues) ? (a!.issues as unknown as AssessmentIssue[]) : [];

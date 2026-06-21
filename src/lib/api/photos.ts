// Phase 5 — job_photos API (Supabase Storage + job_photos table).
//
// The bucket is private; the UI gets short-lived signed URLs for display.
// Path convention: "<job_id>/<type>/<uuid>.<ext>" — first folder = job_id
// is what RLS keys on (see migration 20260518160000_phase5_photos.sql).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { compressImage } from "@/lib/imageCompress";
import { PERSIST_GC_TIME } from "@/lib/queryPersist";

export type JobPhoto = Tables<"job_photos">;
export type JobPhotoType = JobPhoto["type"];

export type JobPhotoWithUrl = JobPhoto & {
  url: string;
  uploader: { id: string; full_name: string | null } | null;
};

const BUCKET = "job-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — refresh on next query

export const photosQueryKey = (jobId: string) => ["job_photos", jobId] as const;

export function usePhotos(jobId: string | undefined) {
  return useQuery({
    queryKey: photosQueryKey(jobId ?? ""),
    enabled: !!jobId,
    // Offline: keep the metadata + signed URLs cached so the cleaner can
    // still see previously uploaded photos. Signed URLs expire in 1h but
    // the SW StaleWhileRevalidate cache holds the actual image bytes for
    // 7 days, so even with an expired URL the image still renders.
    gcTime: PERSIST_GC_TIME,
    queryFn: async (): Promise<JobPhotoWithUrl[]> => {
      if (!jobId) return [];
      const { data: rows, error } = await supabase
        .from("job_photos")
        .select("*, uploader:profiles!job_photos_uploaded_by_fkey(id, full_name)")
        .eq("job_id", jobId)
        .order("uploaded_at", { ascending: true });
      if (error) throw error;
      if (!rows || rows.length === 0) return [];

      // Batch-sign every path in one round trip.
      const paths = rows.map((r) => r.storage_path);
      const { data: signed, error: sErr } = await supabase
        .storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      if (sErr) throw sErr;

      const urlByPath = new Map(
        (signed ?? []).map((s) => [s.path, s.signedUrl] as const),
      );
      return rows.map((r) => ({
        ...(r as JobPhoto),
        uploader: (r as unknown as { uploader: JobPhotoWithUrl["uploader"] }).uploader ?? null,
        url: urlByPath.get(r.storage_path) ?? "",
      }));
    },
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      type,
      file,
    }: {
      jobId: string;
      type: JobPhotoType;
      file: File;
    }): Promise<JobPhoto> => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      // Resize/compress in the browser before upload.
      const blob = await compressImage(file);
      const ext = guessExtension(blob.type, file.name);
      const filename = `${crypto.randomUUID()}.${ext}`;
      const storagePath = `${jobId}/${type}/${filename}`;

      const { error: upErr } = await supabase
        .storage
        .from(BUCKET)
        .upload(storagePath, blob, {
          contentType: blob.type || "image/jpeg",
          upsert: false,
        });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase
        .from("job_photos")
        .insert({
          job_id: jobId,
          type,
          storage_path: storagePath,
          uploaded_by: userId,
        })
        .select()
        .single();
      if (insErr) {
        // Best-effort: roll back the storage upload so we don't leave an orphan.
        await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
        throw insErr;
      }

      return row;
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: photosQueryKey(vars.jobId) });
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: JobPhoto): Promise<void> => {
      // Storage first, then the metadata row. The user's auth context has
      // an explicit storage RLS policy permitting this delete (technician
      // for their own job, manager/admin always). A best-effort trigger on
      // job_photos cleans up any orphan if the row is deleted via cascade
      // instead of this client path.
      const { error: storageErr } = await supabase
        .storage
        .from(BUCKET)
        .remove([photo.storage_path]);
      if (storageErr) {
        // Don't bail — the file might already be gone (idempotent retry,
        // manual cleanup, etc.). Log so we can spot real permission issues.
        console.warn("photo storage delete failed", { path: photo.storage_path, error: storageErr });
      }

      const { error: rowErr } = await supabase
        .from("job_photos")
        .delete()
        .eq("id", photo.id);
      if (rowErr) throw rowErr;
    },
    onSuccess: (_void, photo) => {
      qc.invalidateQueries({ queryKey: photosQueryKey(photo.job_id) });
    },
  });
}

function guessExtension(mime: string, fallbackName: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  const m = /\.([a-z0-9]+)$/i.exec(fallbackName);
  return m ? m[1].toLowerCase() : "jpg";
}

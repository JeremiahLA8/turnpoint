// Phase 8 (finish) — durable offline write queue for cleaner actions.
//
// Cleaners work in homes with bad or no signal. When a job update (acknowledge,
// start, complete, cancel, notes, checklist) can't reach the server, we queue
// the patch in IndexedDB and update the UI optimistically, so the cleaner's day
// keeps moving. A background sync replays the queue (FIFO) once back online and
// survives app reloads/closes. Photo uploads are out of scope here (binary, big)
// — they retry on their own when the cleaner is back in signal.

import { get, set, del } from "idb-keyval";
import type { Tables } from "@/integrations/supabase/types";

type CleaningJobUpdate = Partial<Tables<"cleaning_jobs">>;

const QUEUE_KEY = "cleanos-offline-job-queue";

export type QueuedJobPatch = {
  id: string;
  jobId: string;
  patch: CleaningJobUpdate;
  queuedAt: string;
};

// True when an error (or the browser state) indicates a connectivity problem
// rather than a real server rejection (RLS, validation). Pure + unit-tested.
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!err) return false;
  // supabase-js wraps fetch failures; the browser throws TypeError "Failed to fetch".
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("fetch failed")
  );
}

export async function getQueue(): Promise<QueuedJobPatch[]> {
  return (await get<QueuedJobPatch[]>(QUEUE_KEY)) ?? [];
}

export async function enqueueJobPatch(jobId: string, patch: CleaningJobUpdate): Promise<QueuedJobPatch> {
  const item: QueuedJobPatch = {
    id: crypto.randomUUID(),
    jobId,
    patch,
    queuedAt: new Date().toISOString(),
  };
  const q = await getQueue();
  q.push(item);
  await set(QUEUE_KEY, q);
  return item;
}

export async function removeFromQueue(id: string): Promise<void> {
  const q = await getQueue();
  const next = q.filter((x) => x.id !== id);
  if (next.length === 0) await del(QUEUE_KEY);
  else await set(QUEUE_KEY, next);
}

export async function clearQueue(): Promise<void> {
  await del(QUEUE_KEY);
}

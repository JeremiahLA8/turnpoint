// Drains the offline job-patch queue (see offlineQueue.ts) whenever we're back
// online — on mount, on the browser "online" event, and on a 30s interval as a
// backstop for flaky signal. Replays FIFO; stops on the first network error
// (still offline) and drops a patch only if the server hard-rejects it, so one
// bad item can't wedge the queue.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getQueue, removeFromQueue, isNetworkError } from "@/lib/offlineQueue";
import { jobsQueryKey } from "@/lib/api/jobs";

export function useOfflineSync() {
  const qc = useQueryClient();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const running = useRef(false);

  const refreshCount = useCallback(async () => {
    setPending((await getQueue()).length);
  }, []);

  const drain = useCallback(async () => {
    if (running.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await refreshCount();
      return;
    }
    running.current = true;
    setSyncing(true);
    try {
      const q = await getQueue();
      let changed = false;
      for (const item of q) {
        try {
          const { error } = await supabase.from("cleaning_jobs").update(item.patch).eq("id", item.jobId);
          if (error) throw error;
          await removeFromQueue(item.id);
          changed = true;
        } catch (e) {
          if (isNetworkError(e)) break; // still offline — keep the rest, retry later
          console.error("offline sync: dropping unrecoverable patch", item, e);
          await removeFromQueue(item.id); // poison item — don't wedge the queue
          changed = true;
        }
      }
      if (changed) qc.invalidateQueries({ queryKey: jobsQueryKey });
    } finally {
      running.current = false;
      setSyncing(false);
      await refreshCount();
    }
  }, [qc, refreshCount]);

  useEffect(() => {
    void refreshCount();
    void drain();
    const onOnline = () => { setOnline(true); void drain(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const iv = setInterval(() => void drain(), 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(iv);
    };
  }, [drain, refreshCount]);

  return { pending, syncing, online };
}

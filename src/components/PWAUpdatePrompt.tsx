// Phase 8 — surface a "new version available" toast when the service worker
// has fetched updated app code. The user gets to choose when to reload —
// we don't auto-reload because they could be mid-checklist or mid-photo.
//
// Also surfaces an offline-ready toast on first install so the cleaner
// knows the app will work on the truck.

import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Every hour, ping the SW to check for updates. Keeps cleaners on the
      // latest code without forcing a reload.
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success("CleanOS is ready to use offline", {
        duration: 4000,
        onAutoClose: () => setOfflineReady(false),
        onDismiss: () => setOfflineReady(false),
      });
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast("A new version of CleanOS is available", {
        duration: Infinity,
        action: (
          <Button
            size="sm"
            onClick={() => {
              updateServiceWorker(true);
              setNeedRefresh(false);
            }}
          >
            Reload
          </Button>
        ),
        onDismiss: () => setNeedRefresh(false),
      });
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}

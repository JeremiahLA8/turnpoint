// Zero-config onboarding — paste a Hostaway Account ID + API key and the app
// validates, stores them server-side, and runs the first sync so properties +
// upcoming turns appear. The key is sent to an edge function and never stored
// client-side.

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { propertiesQueryKey } from "@/lib/api/properties";
import { jobsQueryKey } from "@/lib/api/jobs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

export function HostawayConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = accountId.trim().length > 0 && apiKey.trim().length > 0;

  async function connect() {
    if (!valid) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("hostaway-connect", {
        body: { accountId: accountId.trim(), apiKey: apiKey.trim() },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || "Couldn't connect Hostaway");

      toast.success("Hostaway connected — syncing your properties…");
      const sync = await supabase.functions.invoke("hostaway-sync");
      if (sync.error) throw sync.error;
      const p = (sync.data as { properties?: { created: number; updated: number } })?.properties;
      const j = (sync.data as { jobs?: { created: number; updated: number } })?.jobs;
      qc.invalidateQueries({ queryKey: propertiesQueryKey });
      qc.invalidateQueries({ queryKey: jobsQueryKey });
      toast.success(`Synced: ${p?.created ?? 0} new properties, ${j?.created ?? 0} new turns`);
      setAccountId("");
      setApiKey("");
      onClose();
    } catch (e) {
      toast.error(`Connect failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Hostaway</DialogTitle>
          <DialogDescription>
            Paste your Hostaway API credentials and we'll pull in your properties and upcoming turns.
            Find them in Hostaway under Settings → Hostaway API.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ha-account" className="text-xs">Account ID</Label>
            <Input
              id="ha-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 187752"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ha-key" className="text-xs">API key</Label>
            <Input
              id="ha-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Hostaway API key"
              className="font-mono"
            />
          </div>
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> Stored securely server-side. Never shown in the browser again.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={connect} disabled={!valid || busy}>
            {busy ? "Connecting…" : "Connect & sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

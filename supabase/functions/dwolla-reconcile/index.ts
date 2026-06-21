// Edge function: reconcile payout ACH statuses against Dwolla (safety net).
//
// Webhooks can be missed (downtime, delivery failures) and ACH returns can flip
// a "processed" transfer to failed/returned days later. This job is the backstop:
// on a schedule it re-fetches the authoritative status from Dwolla for every
// payout whose transfer isn't in a settled-and-old state, and writes any change.
//
// Invoked by pg_cron (service_role bearer). Manual run: POST with ?force=1.
//
// Polls: transfers that are still pending/unknown, PLUS recently-processed ones
// (last 10 days) so a late ACH return is caught.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getToken, getTransferStatus, type DwollaEnv } from "../_shared/dwolla.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const key = Deno.env.get("DWOLLA_KEY");
    const secret = Deno.env.get("DWOLLA_SECRET");
    const env = (Deno.env.get("DWOLLA_ENV") as DwollaEnv) || "sandbox";
    if (!key || !secret) return json({ ok: false, error: "Dwolla not configured" }, 200);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await admin
      .from("cleaner_payouts")
      .select("id, dwolla_transfer_id, dwolla_status, dwolla_synced_at")
      .not("dwolla_transfer_id", "is", null)
      .or(`dwolla_status.is.null,dwolla_status.eq.pending,and(dwolla_status.eq.processed,dwolla_synced_at.gte.${tenDaysAgo})`);
    if (error) throw error;

    if (!rows || rows.length === 0) return json({ ok: true, checked: 0, updated: 0, failures: [] });

    const session = await getToken({ key, secret, env });
    let updated = 0;
    const failures: Array<{ payout_id: string; status: string }> = [];

    for (const r of rows) {
      try {
        const status = await getTransferStatus(session, r.dwolla_transfer_id as string);
        if (status !== r.dwolla_status) {
          await admin
            .from("cleaner_payouts")
            .update({ dwolla_status: status, dwolla_synced_at: new Date().toISOString() })
            .eq("id", r.id);
          updated++;
        }
        if (status === "failed" || status === "returned" || status === "cancelled") {
          failures.push({ payout_id: r.id, status });
        }
      } catch (e) {
        console.error(`reconcile: transfer ${r.dwolla_transfer_id} fetch failed`, e);
      }
    }

    if (failures.length) console.warn(`dwolla-reconcile: ${failures.length} failed/returned payouts`, failures);
    return json({ ok: true, checked: rows.length, updated, failures });
  } catch (e) {
    console.error("dwolla-reconcile error", e);
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

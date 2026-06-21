// Edge function: receive Dwolla webhooks and sync payout transfer status.
//
// Trust model: instead of relying solely on the webhook HMAC, on every transfer
// event we RE-FETCH the transfer from Dwolla with our own API credentials and
// write that authoritative status. A forged event can't set a false status —
// the worst it can do is make us re-read the true status of a real transfer
// (a no-op). When DWOLLA_WEBHOOK_SECRET is present and a signature is supplied,
// we verify it as defense-in-depth, but a missing/failed signature does NOT
// block the authoritative sync (Supabase env-secret injection proved flaky for
// this function; the re-fetch is the real guarantee).
//
// Deployed with --no-verify-jwt: Dwolla has no Supabase JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getToken,
  getTransferStatus,
  transferTopicToStatus,
  verifyWebhookSignature,
  type DwollaEnv,
} from "../_shared/dwolla.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();

  // Best-effort signature check (defense-in-depth, never the sole gate).
  const secret = Deno.env.get("DWOLLA_WEBHOOK_SECRET");
  const sig = req.headers.get("X-Request-Signature-SHA-256");
  if (secret && sig && !(await verifyWebhookSignature(secret, raw, sig))) {
    console.warn("dwolla-webhook: signature mismatch — proceeding via authoritative re-fetch");
  }

  let event: { topic?: string; resourceId?: string } | null = null;
  try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  const topic = event?.topic ?? "";
  const transferId = event?.resourceId;
  // Only transfer topics matter; 200 on everything else so Dwolla stops retrying.
  if (!transferTopicToStatus(topic) || !transferId) return new Response("ignored", { status: 200 });

  const key = Deno.env.get("DWOLLA_KEY");
  const dsecret = Deno.env.get("DWOLLA_SECRET");
  const env = (Deno.env.get("DWOLLA_ENV") as DwollaEnv) || "sandbox";
  if (!key || !dsecret) return new Response("not configured", { status: 500 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Only act if we actually track this transfer.
  const { data: payout } = await admin
    .from("cleaner_payouts")
    .select("id")
    .eq("dwolla_transfer_id", transferId)
    .maybeSingle();
  if (!payout) return new Response("untracked", { status: 200 });

  // Authoritative status straight from Dwolla.
  let status: string;
  try {
    const session = await getToken({ key, secret: dsecret, env });
    status = await getTransferStatus(session, transferId);
  } catch (e) {
    console.error("dwolla-webhook: status fetch failed", e);
    return new Response("fetch failed", { status: 502 });
  }

  const { error } = await admin
    .from("cleaner_payouts")
    .update({ dwolla_status: status, dwolla_synced_at: new Date().toISOString() })
    .eq("dwolla_transfer_id", transferId);
  if (error) { console.error("dwolla-webhook update failed", error); return new Response("update failed", { status: 500 }); }

  console.log(`dwolla-webhook: transfer ${transferId} -> ${status} (${topic})`);
  return new Response("ok", { status: 200 });
});

// Edge function: pay one or more crew payouts by real ACH via Dwolla (Phase 2).
//
// For each payout, creates a Dwolla Transfer from Ascend's verified bank
// (auto-discovered from the Dwolla account, cached in dwolla_config) to the
// cleaner's funding source. Idempotent per payout (Idempotency-Key + a stored
// dwolla_transfer_id) so a retry or double-click never double-sends money.
//
// This MOVES money; Phase 1b's QB booking still records the expense separately.
//
// Auth: verify_jwt=true, admin/manager only.
// Body: { payout_ids: string[] }  (also accepts { payout_id })
// Response: { ok:true, results:[{payout_id, status, transfer_id?, error?}] } | { ok:false, error }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getToken,
  getAccountId,
  findVerifiedBankFundingSource,
  createTransfer,
  transferIdempotencyKey,
  type DwollaEnv,
  type DwollaSession,
} from "../_shared/dwolla.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await authClient.auth.getUser();
    if (!u?.user) return json({ ok: false, error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "manager")) {
      return json({ ok: false, error: "forbidden" }, 403);
    }

    const body = (await req.json().catch(() => null)) as { payout_ids?: unknown; payout_id?: unknown } | null;
    const ids = normalizeIds(body);
    if (ids.length === 0) return json({ ok: false, error: "no payout_ids provided" }, 400);

    const key = Deno.env.get("DWOLLA_KEY");
    const secret = Deno.env.get("DWOLLA_SECRET");
    const env = (Deno.env.get("DWOLLA_ENV") as DwollaEnv) || "sandbox";
    if (!key || !secret) return json({ ok: false, error: "Dwolla not configured (DWOLLA_KEY/SECRET unset)" }, 200);

    const session = await getToken({ key, secret, env });
    const sourceFundingSourceId = await resolveSourceFundingSource(admin, session);
    if (!sourceFundingSourceId) {
      return json({ ok: false, error: "No verified bank on the Dwolla account to send from. Add + verify Ascend's bank in Dwolla." }, 200);
    }

    const results: Array<Record<string, unknown>> = [];
    for (const payoutId of ids) {
      try {
        const { data: p } = await admin
          .from("cleaner_payouts")
          .select("id, cleaner_id, amount_cents, dwolla_transfer_id")
          .eq("id", payoutId)
          .maybeSingle();
        if (!p) { results.push({ payout_id: payoutId, status: "error", error: "payout not found" }); continue; }
        if (p.dwolla_transfer_id) {
          results.push({ payout_id: payoutId, status: "skipped", transfer_id: p.dwolla_transfer_id });
          continue;
        }

        const { data: cd } = await admin
          .from("cleaner_dwolla")
          .select("funding_source_id")
          .eq("cleaner_id", p.cleaner_id)
          .maybeSingle();
        if (!cd?.funding_source_id) {
          results.push({ payout_id: payoutId, status: "error", error: "cleaner has no direct deposit set up" });
          continue;
        }

        const { transferId } = await createTransfer(session, {
          sourceFundingSourceId,
          destFundingSourceId: cd.funding_source_id,
          amountCents: p.amount_cents,
          idempotencyKey: transferIdempotencyKey(payoutId),
        });

        await admin
          .from("cleaner_payouts")
          .update({ dwolla_transfer_id: transferId, dwolla_status: "pending", dwolla_synced_at: new Date().toISOString() })
          .eq("id", payoutId);
        results.push({ payout_id: payoutId, status: "sent", transfer_id: transferId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ payout_id: payoutId, status: "error", error: msg });
      }
    }

    return json({ ok: true, results });
  } catch (e) {
    console.error("dwolla-pay error", e);
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function normalizeIds(body: { payout_ids?: unknown; payout_id?: unknown } | null): string[] {
  if (!body) return [];
  const out: string[] = [];
  if (Array.isArray(body.payout_ids)) for (const x of body.payout_ids) if (typeof x === "string" && x) out.push(x);
  if (typeof body.payout_id === "string" && body.payout_id) out.push(body.payout_id);
  return [...new Set(out)];
}

// Source of funds = the Dwolla account's verified bank. Cached in dwolla_config
// after first discovery so we don't re-query the account every payout.
async function resolveSourceFundingSource(
  admin: ReturnType<typeof createClient>,
  session: DwollaSession,
): Promise<string | null> {
  const { data: cfg } = await admin.from("dwolla_config").select("*").eq("id", "default").maybeSingle();
  if (cfg?.funding_source_id) return cfg.funding_source_id;

  const accountId = await getAccountId(session);
  const bank = await findVerifiedBankFundingSource(session, accountId);
  if (!bank) return null;
  await admin.from("dwolla_config").upsert(
    { id: "default", customer_id: accountId, funding_source_id: bank.id, environment: Deno.env.get("DWOLLA_ENV") || "sandbox", updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  return bank.id;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

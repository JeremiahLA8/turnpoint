// Edge function: send a single SMS via Twilio.
//
// Auth: verify_jwt=true (default). Frontend invokes with the user's JWT
// (managers/admins via supabase.functions.invoke). pg_cron invokes with the
// service_role key as Bearer (see migration 20260518150000_phase4_sms.sql).
//
// Body: { to: string, body: string }
// Response: { ok: true, sid: string } | { ok: true, skipped: true, reason: string } | { ok: false, error: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSms, normalizePhone } from "../_shared/sms.ts";

// A2P 10DLC compliance: only deliver to recipients who have an affirmative
// SMS opt-in on file (profiles.sms_consent_at). We match the requested number
// against every consented profile phone (normalized to E.164 on both sides so
// raw-vs-formatted storage can't cause a false negative). When consent is
// absent — or can't be verified — we do NOT send. Returns true when it's safe.
async function hasSmsConsent(rawTo: string): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.warn("send-sms: cannot verify consent (admin creds unset)");
    return false;
  }
  const target = normalizePhone(rawTo);
  if (!target) return false;

  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("profiles")
    .select("phone")
    .not("sms_consent_at", "is", null)
    .not("phone", "is", null);
  if (error) {
    console.error("send-sms: consent lookup failed", error);
    return false;
  }
  return (data ?? []).some((row) => normalizePhone(row.phone as string) === target);
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const payload = await req.json().catch(() => null) as { to?: unknown; body?: unknown } | null;
    if (!payload) return json({ error: "invalid json" }, 400);
    const to = typeof payload.to === "string" ? payload.to : "";
    const body = typeof payload.body === "string" ? payload.body : "";
    if (!to) return json({ error: "missing 'to'" }, 400);
    if (!body) return json({ error: "missing 'body'" }, 400);

    if (!(await hasSmsConsent(to))) {
      console.log("send-sms: no SMS consent on file, skipping", { to });
      return json({ ok: true, skipped: true, reason: "no sms consent on file" });
    }

    const result = await sendSms(to, body);
    if (!result.ok) return json(result, 502);
    return json(result);
  } catch (e) {
    console.error("send-sms error", e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

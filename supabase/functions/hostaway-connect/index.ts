// Edge function: connect a Hostaway account by pasting credentials (onboarding).
//
// Validates the Account ID + API key against Hostaway (requests a token), then
// stores them in hostaway_config so hostaway-sync can use them. The key is held
// service-role-side only; the client never reads it back.
//
// Auth: verify_jwt=true, admin/manager only.
// Body: { accountId, apiKey }
// Response: { ok:true } | { ok:false, error }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    const body = (await req.json().catch(() => null)) as { accountId?: string; apiKey?: string } | null;
    const accountId = (body?.accountId ?? "").trim();
    const apiKey = (body?.apiKey ?? "").trim();
    if (!accountId || !apiKey) return json({ ok: false, error: "Account ID and API key are required" }, 400);

    // Validate by requesting a token from Hostaway.
    const res = await fetch("https://api.hostaway.com/v1/accessTokens", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: accountId,
        client_secret: apiKey,
        scope: "general",
      }),
    });
    if (!res.ok) {
      return json({ ok: false, error: "Hostaway rejected those credentials — double-check the Account ID and API key." }, 200);
    }

    await admin.from("hostaway_config").upsert(
      { id: "default", account_id: accountId, api_key: apiKey, status: "connected", connected_at: new Date().toISOString() },
      { onConflict: "id" },
    );

    return json({ ok: true });
  } catch (e) {
    console.error("hostaway-connect error", e);
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Edge function: set up a cleaner for direct deposit (Dwolla Phase 2).
//
// Creates a Dwolla receive-only customer for the cleaner and attaches their
// bank account as a funding source. Raw account/routing numbers go straight to
// Dwolla and are NEVER persisted here — we store only Dwolla's ids + a last4.
//
// Auth: verify_jwt=true, admin/manager only.
// Body: { cleaner_id, routingNumber, accountNumber, bankAccountType }
// Response: { ok:true, last4, status } | { ok:false, error }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getToken,
  createReceiveOnlyCustomer,
  createBankFundingSource,
  type DwollaEnv,
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

    const body = (await req.json().catch(() => null)) as {
      cleaner_id?: string;
      routingNumber?: string;
      accountNumber?: string;
      bankAccountType?: string;
    } | null;
    const cleanerId = body?.cleaner_id;
    const routingNumber = (body?.routingNumber ?? "").trim();
    const accountNumber = (body?.accountNumber ?? "").trim();
    const bankAccountType = body?.bankAccountType === "savings" ? "savings" : "checking";
    if (!cleanerId) return json({ ok: false, error: "missing cleaner_id" }, 400);
    if (!/^\d{9}$/.test(routingNumber)) return json({ ok: false, error: "routing number must be 9 digits" }, 400);
    if (!/^\d{4,17}$/.test(accountNumber)) return json({ ok: false, error: "invalid account number" }, 400);

    const key = Deno.env.get("DWOLLA_KEY");
    const secret = Deno.env.get("DWOLLA_SECRET");
    const env = (Deno.env.get("DWOLLA_ENV") as DwollaEnv) || "sandbox";
    if (!key || !secret) return json({ ok: false, error: "Dwolla not configured" }, 200);

    // Cleaner identity: name from profile, email from auth.
    const { data: prof } = await admin.from("profiles").select("full_name").eq("id", cleanerId).maybeSingle();
    const { data: authUser } = await admin.auth.admin.getUserById(cleanerId);
    const email = authUser?.user?.email;
    if (!email) return json({ ok: false, error: "cleaner has no email on file" }, 200);
    const parts = (prof?.full_name ?? "").trim().split(/\s+/);
    const firstName = parts[0] || "Cleaner";
    const lastName = parts.slice(1).join(" ") || "Crew";

    const session = await getToken({ key, secret, env });

    // Reuse the existing Dwolla customer if we already made one for this cleaner.
    const { data: existing } = await admin
      .from("cleaner_dwolla")
      .select("customer_id")
      .eq("cleaner_id", cleanerId)
      .maybeSingle();
    const customerId = existing?.customer_id
      ?? (await createReceiveOnlyCustomer(session, { firstName, lastName, email }));

    const { fundingSourceId, last4 } = await createBankFundingSource(session, customerId, {
      routingNumber,
      accountNumber,
      bankAccountType,
      name: `${firstName} ${lastName} bank`,
    });

    await admin.from("cleaner_dwolla").upsert(
      {
        cleaner_id: cleanerId,
        customer_id: customerId,
        funding_source_id: fundingSourceId,
        bank_last4: last4,
        status: "verified",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cleaner_id" },
    );

    return json({ ok: true, last4, status: "verified" });
  } catch (e) {
    console.error("dwolla-onboard-cleaner error", e);
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

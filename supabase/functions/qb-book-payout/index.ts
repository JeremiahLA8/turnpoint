// Edge function: book one or more crew payouts into QuickBooks as expenses.
//
// Phase 1b of crew payouts. The frontend calls this right after recording a
// payout (Mark paid) — and the Pay hub's "Book to QB" retry calls it for any
// payout that failed earlier. Each payout becomes a QBO Purchase (cash/check
// expense) posted to the dedicated "Cleaning - Crew" account, tagged with the
// "Cleaning Ops" class + the property as a tracking customer, so cleaning ops
// stay cleanly separable from the rest of Ascend's books. See the 2026-06-18
// decision in the second brain's decisions/log.md.
//
// Idempotent: a payout already carrying a qb_purchase_id is skipped, so retries
// (or a double-click) never double-book.
//
// Auth: verify_jwt=true. Only admin/manager callers may book (checked here).
//
// Body: { payout_ids: string[] }  (also accepts { payout_id: string })
// Response: { ok: true, results: [{ payout_id, status, purchase_id?, error? }] }
//         | { ok: false, error: string }   (configuration / connection problems)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildPurchasePayload,
  createPurchase,
  findAccountByName,
  findCustomerByName,
  findOrCreateClass,
  findOrCreateExpenseAccount,
  findOrCreateVendor,
  refreshAccessToken,
  type PayoutForBooking,
  type QbRef,
  type QbSession,
} from "../_shared/qb.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXPENSE_ACCOUNT = Deno.env.get("QB_EXPENSE_ACCOUNT_NAME") || "Cleaning - Crew";
const CLASS_NAME = Deno.env.get("QB_CLASS_NAME") || "Cleaning Ops";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    // --- authn/authz: caller must be a signed-in admin or manager ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ ok: false, error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed = (roles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (!allowed) return json({ ok: false, error: "forbidden" }, 403);

    // --- parse target payout ids ---
    const body = (await req.json().catch(() => null)) as
      | { payout_ids?: unknown; payout_id?: unknown }
      | null;
    const ids = normalizeIds(body);
    if (ids.length === 0) return json({ ok: false, error: "no payout_ids provided" }, 400);

    // --- QB config ---
    const clientId = Deno.env.get("QB_CLIENT_ID");
    const clientSecret = Deno.env.get("QB_CLIENT_SECRET");
    const bankAccountName = Deno.env.get("QB_PAYOUT_BANK_ACCOUNT");
    if (!clientId || !clientSecret) {
      return json({ ok: false, error: "QB not configured (QB_CLIENT_ID / QB_CLIENT_SECRET unset)" }, 200);
    }
    if (!bankAccountName) {
      return json({ ok: false, error: "QB_PAYOUT_BANK_ACCOUNT unset (the account crew payouts are paid from)" }, 200);
    }

    // --- QB connection / access token (reuse cached token until it expires) ---
    const { data: conn } = await admin.from("qb_connection").select("*").eq("id", "default").maybeSingle();
    if (!conn) {
      return json({ ok: false, error: "QB not connected — run the one-time connect (see QB_SETUP.md)" }, 200);
    }

    const session = await ensureSession(admin, conn, { clientId, clientSecret });

    // --- resolve shared refs once for the whole batch ---
    const paymentAccountRef = await findAccountByName(session, bankAccountName);
    if (!paymentAccountRef) {
      return json({ ok: false, error: `QB account "${bankAccountName}" not found — check QB_PAYOUT_BANK_ACCOUNT` }, 200);
    }
    const expenseAccountRef = await findOrCreateExpenseAccount(session, EXPENSE_ACCOUNT);
    const classRef = await findOrCreateClass(session, CLASS_NAME);

    // per-batch caches so we resolve each cleaner/property once
    const vendorCache = new Map<string, QbRef | null>();
    const customerCache = new Map<string, QbRef | null>();

    const results: Array<Record<string, unknown>> = [];
    for (const payoutId of ids) {
      try {
        const payout = await loadPayout(admin, payoutId);
        if (!payout) {
          results.push({ payout_id: payoutId, status: "error", error: "payout not found" });
          continue;
        }
        if (payout.qb_purchase_id) {
          results.push({ payout_id: payoutId, status: "skipped", purchase_id: payout.qb_purchase_id });
          continue;
        }

        const cleanerName = payout.cleanerName || "Crew member";
        let vendorRef = vendorCache.get(cleanerName);
        if (vendorRef === undefined) {
          vendorRef = await findOrCreateVendor(session, cleanerName);
          vendorCache.set(cleanerName, vendorRef);
        }

        let customerRef: QbRef | null = null;
        if (payout.propertyLabel) {
          const cached = customerCache.get(payout.propertyLabel);
          if (cached === undefined) {
            customerRef = await findCustomerByName(session, payout.propertyLabel);
            customerCache.set(payout.propertyLabel, customerRef);
          } else {
            customerRef = cached;
          }
        }

        const forBooking: PayoutForBooking = {
          jobId: payout.job_id,
          amountCents: payout.amount_cents,
          method: payout.method,
          paidAtISO: payout.paid_at,
          cleanerName,
          propertyLabel: payout.propertyLabel,
          cleanDateISO: payout.cleanDateISO,
        };
        const payload = buildPurchasePayload(forBooking, {
          paymentAccountRef,
          expenseAccountRef,
          classRef,
          vendorRef,
          customerRef,
        });

        const { id: purchaseId } = await createPurchase(session, payload);
        await admin
          .from("cleaner_payouts")
          .update({ qb_purchase_id: purchaseId, qb_synced_at: new Date().toISOString(), qb_sync_error: null })
          .eq("id", payoutId);
        results.push({ payout_id: payoutId, status: "booked", purchase_id: purchaseId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin.from("cleaner_payouts").update({ qb_sync_error: msg.slice(0, 500) }).eq("id", payoutId);
        results.push({ payout_id: payoutId, status: "error", error: msg });
      }
    }

    return json({ ok: true, results });
  } catch (e) {
    console.error("qb-book-payout error", e);
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function normalizeIds(body: { payout_ids?: unknown; payout_id?: unknown } | null): string[] {
  if (!body) return [];
  const out: string[] = [];
  if (Array.isArray(body.payout_ids)) {
    for (const x of body.payout_ids) if (typeof x === "string" && x) out.push(x);
  }
  if (typeof body.payout_id === "string" && body.payout_id) out.push(body.payout_id);
  return [...new Set(out)];
}

// Reuse the stored access token until it's within 60s of expiry; otherwise
// refresh and persist the rotated refresh token + new access token. The edge
// function is the sole writer of qb_connection, so this stays consistent.
async function ensureSession(
  admin: ReturnType<typeof createClient>,
  conn: { refresh_token: string; realm_id: string; access_token: string | null; access_token_expires_at: string | null },
  auth: { clientId: string; clientSecret: string },
): Promise<QbSession> {
  const now = Date.now();
  const exp = conn.access_token_expires_at ? Date.parse(conn.access_token_expires_at) : 0;
  if (conn.access_token && exp > now + 60_000) {
    return { accessToken: conn.access_token, realmId: conn.realm_id };
  }
  const refreshed = await refreshAccessToken(auth, conn.refresh_token);
  const expiresAt = new Date(now + refreshed.expiresInSec * 1000).toISOString();
  await admin
    .from("qb_connection")
    .update({
      refresh_token: refreshed.refreshToken,
      access_token: refreshed.accessToken,
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default");
  return { accessToken: refreshed.accessToken, realmId: conn.realm_id };
}

type LoadedPayout = {
  id: string;
  job_id: string;
  amount_cents: number;
  method: string | null;
  paid_at: string;
  qb_purchase_id: string | null;
  cleanerName: string | null;
  propertyLabel: string | null;
  cleanDateISO: string | null;
};

async function loadPayout(
  admin: ReturnType<typeof createClient>,
  payoutId: string,
): Promise<LoadedPayout | null> {
  const { data: p } = await admin
    .from("cleaner_payouts")
    .select("id, job_id, cleaner_id, property_id, amount_cents, method, paid_at, qb_purchase_id")
    .eq("id", payoutId)
    .maybeSingle();
  if (!p) return null;

  const [{ data: prof }, { data: job }, propRes] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", p.cleaner_id).maybeSingle(),
    admin.from("cleaning_jobs").select("scheduled_start").eq("id", p.job_id).maybeSingle(),
    p.property_id
      ? admin.from("properties").select("name, nickname").eq("id", p.property_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const prop = (propRes as { data: { name: string; nickname: string | null } | null }).data;
  return {
    id: p.id,
    job_id: p.job_id,
    amount_cents: p.amount_cents,
    method: p.method,
    paid_at: p.paid_at,
    qb_purchase_id: p.qb_purchase_id,
    cleanerName: prof?.full_name ?? null,
    propertyLabel: prop?.name ?? prop?.nickname ?? null,
    cleanDateISO: job?.scheduled_start ?? null,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

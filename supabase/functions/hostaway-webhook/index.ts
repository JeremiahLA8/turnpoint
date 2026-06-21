// Hostaway Unified Webhook receiver.
// Registered in Hostaway dashboard -> Settings -> Integrations -> Unified Webhooks.
// Endpoint: https://<project>.supabase.co/functions/v1/hostaway-webhook
//
// Hostaway authenticates via HTTP Basic Auth (login + password configured in
// the Hostaway UI). We verify against HOSTAWAY_WEBHOOK_USER and
// HOSTAWAY_WEBHOOK_PASSWORD secrets.
//
// We handle reservation events: create/modify -> upsert cleaning_jobs row,
// cancel/delete -> mark status='cancelled' (keep the row).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { mapReservationToJob, type HostawayReservation } from "../_shared/hostaway.ts";
import { sendSms } from "../_shared/sms.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function verifyBasicAuth(header: string, expectedUser: string, expectedPass: string): boolean {
  if (!header.toLowerCase().startsWith("basic ")) return false;
  const b64 = header.slice(6).trim();
  let decoded: string;
  try {
    decoded = atob(b64);
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass);
}

type WebhookEvent = {
  object?: string;          // "reservation"
  event?: string;            // "reservation.created" | "reservation.modified" | "reservation.cancelled" | "reservation.deleted"
  data?: HostawayReservation;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    // ---- Basic Auth verification ----
    const expectedUser = Deno.env.get("HOSTAWAY_WEBHOOK_USER");
    const expectedPass = Deno.env.get("HOSTAWAY_WEBHOOK_PASSWORD");
    if (!expectedUser || !expectedPass) {
      console.error("HOSTAWAY_WEBHOOK_USER / HOSTAWAY_WEBHOOK_PASSWORD not set");
      return json({ error: "server misconfigured" }, 500);
    }
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Basic realm="hostaway"',
        },
      });
    }
    if (!verifyBasicAuth(authHeader, expectedUser, expectedPass)) {
      console.warn("hostaway-webhook basic auth failed");
      return json({ error: "unauthorized" }, 401);
    }

    // ---- Parse ----
    const rawBody = await req.text();
    let payload: WebhookEvent;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    const event = payload.event ?? "";
    const r = payload.data;
    if (payload.object !== "reservation" || !r) {
      // Ignore non-reservation events (e.g. listing changes — could handle later)
      return json({ ok: true, ignored: true, reason: `unhandled object/event: ${payload.object}/${event}` });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const reservationId = String(r.id);

    // Cancellation/deletion: flip status, don't remove the row.
    const isCancellation = event.endsWith(".cancelled") || event.endsWith(".deleted");
    if (isCancellation) {
      const { data: existing } = await admin
        .from("cleaning_jobs")
        .select("id")
        .eq("hostaway_reservation_id", reservationId)
        .maybeSingle();
      if (existing) {
        const { error } = await admin
          .from("cleaning_jobs")
          .update({ status: "cancelled" })
          .eq("id", existing.id);
        if (error) throw error;
        return json({ ok: true, action: "cancelled", id: existing.id });
      }
      return json({ ok: true, action: "cancel-noop", reservation_id: reservationId });
    }

    // Create or modify: look up the property by listingMapId
    if (!r.listingMapId) {
      return json({ ok: true, ignored: true, reason: "reservation missing listingMapId" });
    }
    const { data: prop } = await admin
      .from("properties")
      .select("id, default_cleaner_id")
      .eq("hostaway_listing_id", String(r.listingMapId))
      .maybeSingle();
    if (!prop) {
      // Property not synced yet — defer to next sync run.
      console.warn(`hostaway-webhook: property ${r.listingMapId} not synced; deferring`);
      return json({ ok: true, ignored: true, reason: "property not synced yet" });
    }

    const row = mapReservationToJob(r, prop.id, prop.default_cleaner_id);
    if (!row) {
      return json({ ok: true, ignored: true, reason: "reservation missing departureDate" });
    }

    const { data: existing } = await admin
      .from("cleaning_jobs")
      .select("id, status, scheduled_start, cleaner_id, property:properties(name, nickname)")
      .eq("hostaway_reservation_id", reservationId)
      .maybeSingle();

    if (existing) {
      // Preserve cleaner assignment + don't overwrite a non-scheduled status
      // unless this is an explicit cancellation (handled above).
      const patch: Record<string, unknown> = {
        property_id: row.property_id,
        scheduled_start: row.scheduled_start,
        scheduled_end: row.scheduled_end,
        guest_name: row.guest_name,
        check_in: row.check_in,
        check_out: row.check_out,
      };
      const { error } = await admin.from("cleaning_jobs").update(patch).eq("id", existing.id);
      if (error) throw error;

      // Phase 4: if the scheduled date changed AND a cleaner is already
      // assigned, text them the new date. Compare just the YYYY-MM-DD
      // portion — cleaners only care about the day, not the millisecond.
      const oldDay = existing.scheduled_start ? String(existing.scheduled_start).slice(0, 10) : null;
      const newDay = row.scheduled_start ? String(row.scheduled_start).slice(0, 10) : null;
      if (existing.cleaner_id && oldDay && newDay && oldDay !== newDay) {
        const { data: cleaner } = await admin
          .from("profiles")
          .select("phone")
          .eq("id", existing.cleaner_id)
          .maybeSingle();
        const phone = cleaner?.phone;
        if (phone) {
          const prop = existing.property as { name?: string; nickname?: string } | null;
          const propertyName = prop?.nickname || prop?.name || "your property";
          const when = new Date(row.scheduled_start).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: "America/Los_Angeles",
          });
          await sendSms(phone, `CleanOS: Your cleaning at ${propertyName} has been rescheduled to ${when}.`);
        }
      }

      return json({ ok: true, action: "updated", id: existing.id });
    }
    const { data: inserted, error: insErr } = await admin
      .from("cleaning_jobs")
      .insert(row)
      .select("id")
      .single();
    if (insErr) throw insErr;
    return json({ ok: true, action: "created", id: inserted.id });
  } catch (e) {
    console.error("hostaway-webhook error", e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

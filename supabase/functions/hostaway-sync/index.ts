// On-demand Hostaway sync.
// Pulls all listings -> upserts into `properties`.
// Pulls reservations in [today-30d, today+90d] -> upserts into `cleaning_jobs`.
// Caller must be an authenticated admin or manager.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  listListings,
  listReservations,
  mapListingToProperty,
  mapReservationToJob,
  setHostawayCreds,
} from "../_shared/hostaway.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYNC_PAST_DAYS = 30;
const SYNC_FUTURE_DAYS = 90;

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // ---- Auth: an admin/manager user, OR the scheduled cron job calling
    // server-to-server with the service-role key (same trust model as the
    // Phase 4/7 notify crons). The cron call carries no user session, so we
    // recognise it by the bearer token matching the service-role key.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "missing auth" }, 401);
    }
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.slice("Bearer ".length);
    const isCron = token === serviceRoleKey;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
    );

    if (!isCron) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) {
        return json({ error: "invalid auth" }, 401);
      }
      const { data: roles, error: rolesErr } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      if (rolesErr) throw rolesErr;
      const allowed = (roles ?? []).some((r) => r.role === "admin" || r.role === "manager");
      if (!allowed) return json({ error: "forbidden — admin or manager required" }, 403);
    }

    // ---- Resolve credentials: in-app connected account first, env fallback ----
    const { data: cfg } = await admin
      .from("hostaway_config")
      .select("account_id, api_key")
      .eq("id", "default")
      .maybeSingle();
    if (cfg?.account_id && cfg?.api_key) {
      setHostawayCreds({ accountId: cfg.account_id, clientSecret: cfg.api_key });
    }

    // ---- Sync listings -> properties ----
    const listings = await listListings();
    const listingRows = listings.map(mapListingToProperty);

    // Upsert each listing. We can't bulk-upsert with onConflict on the
    // hostaway_listing_id text column directly via the supabase-js builder
    // unless the column is unique (it is — see migration). The library
    // supports onConflict with the column name.
    let propertiesCreated = 0;
    let propertiesUpdated = 0;
    for (const row of listingRows) {
      const { data: existing } = await admin
        .from("properties")
        .select("id")
        .eq("hostaway_listing_id", row.hostaway_listing_id)
        .maybeSingle();
      if (existing) {
        const { error } = await admin
          .from("properties")
          .update(row)
          .eq("id", existing.id);
        if (error) throw error;
        propertiesUpdated++;
      } else {
        const { error } = await admin.from("properties").insert(row);
        if (error) throw error;
        propertiesCreated++;
      }
    }

    // Refetch property id map keyed by hostaway_listing_id (+ default_cleaner_id)
    const { data: propIndex, error: propIndexErr } = await admin
      .from("properties")
      .select("id, hostaway_listing_id, default_cleaner_id")
      .not("hostaway_listing_id", "is", null);
    if (propIndexErr) throw propIndexErr;
    const propMap = new Map<string, { id: string; default_cleaner_id: string | null }>();
    (propIndex ?? []).forEach((p) =>
      propMap.set(p.hostaway_listing_id!, { id: p.id, default_cleaner_id: p.default_cleaner_id }),
    );

    // ---- Sync reservations -> cleaning_jobs ----
    const today = new Date();
    const past = new Date(today); past.setDate(past.getDate() - SYNC_PAST_DAYS);
    const future = new Date(today); future.setDate(future.getDate() + SYNC_FUTURE_DAYS);
    const reservations = await listReservations({
      fromArrivalDate: fmtDate(past),
      toArrivalDate: fmtDate(future),
    });

    let jobsCreated = 0;
    let jobsUpdated = 0;
    let jobsSkipped = 0;
    // Reservation IDs we saw this sync (for our listings) vs. those that are an
    // active confirmed stay. The difference = reservations that exist in
    // Hostaway's window but are no longer a real checkout (cancelled, or
    // downgraded to inquiry/expired) — their turns get reconciled away below.
    const seenReservationIds = new Set<string>();
    const activeReservationIds = new Set<string>();
    for (const r of reservations) {
      const prop = propMap.get(String(r.listingMapId));
      if (!prop) {
        // Reservation for a listing we didn't import — skip
        jobsSkipped++;
        continue;
      }
      seenReservationIds.add(String(r.id));
      const row = mapReservationToJob(r, prop.id, prop.default_cleaner_id);
      if (!row) {
        // Not a real checkout (inquiry/pending/declined/expired) — no turn.
        jobsSkipped++;
        continue;
      }
      const { data: existing } = await admin
        .from("cleaning_jobs")
        .select("id, cleaner_id, status")
        .eq("hostaway_reservation_id", row.hostaway_reservation_id)
        .maybeSingle();
      if (existing) {
        // Preserve manual cleaner assignment + don't downgrade in-progress/completed status.
        const patch: Record<string, unknown> = {
          property_id: row.property_id,
          scheduled_start: row.scheduled_start,
          scheduled_end: row.scheduled_end,
          guest_name: row.guest_name,
          check_in: row.check_in,
          check_out: row.check_out,
        };
        if (row.status === "cancelled") patch.status = "cancelled";
        else activeReservationIds.add(row.hostaway_reservation_id);
        const { error } = await admin
          .from("cleaning_jobs")
          .update(patch)
          .eq("id", existing.id);
        if (error) throw error;
        jobsUpdated++;
      } else if (row.status !== "cancelled") {
        // Only insert turns for active stays — never create a brand-new
        // already-cancelled turn.
        const { error } = await admin.from("cleaning_jobs").insert(row);
        if (error) throw error;
        activeReservationIds.add(row.hostaway_reservation_id);
        jobsCreated++;
      } else {
        jobsSkipped++;
      }
    }

    // ---- Reconcile phantom/cancelled turns ----
    // Cancel future, not-yet-worked turns whose reservation we saw this sync but
    // which is no longer an active stay. Scoped to reservations we actually saw
    // (so out-of-window real bookings are never touched) and to turns no one has
    // started yet (so completed/in-progress work is safe).
    let jobsCancelled = 0;
    const { data: futureJobs, error: fjErr } = await admin
      .from("cleaning_jobs")
      .select("id, hostaway_reservation_id, status")
      .gte("scheduled_start", fmtDate(today))
      .in("status", ["pending", "assigned", "acknowledged"])
      .not("hostaway_reservation_id", "is", null);
    if (fjErr) throw fjErr;
    const staleIds = (futureJobs ?? [])
      .filter((j) =>
        seenReservationIds.has(j.hostaway_reservation_id) &&
        !activeReservationIds.has(j.hostaway_reservation_id)
      )
      .map((j) => j.id);
    if (staleIds.length > 0) {
      const { error } = await admin
        .from("cleaning_jobs")
        .update({ status: "cancelled" })
        .in("id", staleIds);
      if (error) throw error;
      jobsCancelled = staleIds.length;
    }

    if (cfg?.account_id) {
      await admin.from("hostaway_config").update({ last_sync_at: new Date().toISOString() }).eq("id", "default");
    }

    return json({
      ok: true,
      properties: { created: propertiesCreated, updated: propertiesUpdated, total: listingRows.length },
      jobs: {
        created: jobsCreated,
        updated: jobsUpdated,
        cancelled: jobsCancelled,
        skipped: jobsSkipped,
        total: reservations.length,
        window: { from: fmtDate(past), to: fmtDate(future) },
      },
    });
  } catch (e) {
    console.error("hostaway-sync error", e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Edge function: 7am-Pacific check for today's unassigned jobs.
//
// Invoked by pg_cron at 14:00 + 15:00 UTC daily (covers PDT and PST). The
// function self-guards against running twice by checking the actual PT hour.
// For each manager with a phone on file, sends a one-line summary SMS.
//
// Service role is required (uses admin client to read profiles + roles +
// jobs across the project). Caller authentication is JWT-based.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSms } from "../_shared/sms.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// YYYY-MM-DD in America/Los_Angeles for a given Date.
function ptDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Hour (0-23) in America/Los_Angeles for a given Date.
function ptHour(d: Date): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return parseInt(h, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const now = new Date();
    const hour = ptHour(now);
    // Only fire at 7am PT. Cron runs at both 14:00 + 15:00 UTC; only one of
    // those is 7am locally on any given day (the other is 6am or 8am).
    // Manual invocations (with ?force=1) bypass the hour check.
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    if (!force && hour !== 7) {
      return json({ ok: true, skipped: true, reason: `not 7am PT (currently ${hour}:xx PT)` });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = ptDateString(now);

    // PT day bounds in UTC. We use a 30-hour window centered on the PT day
    // and filter to PT date in JS — robust against DST transitions.
    const windowStart = new Date(`${today}T00:00:00Z`);
    windowStart.setUTCHours(windowStart.getUTCHours() - 12);
    const windowEnd = new Date(`${today}T00:00:00Z`);
    windowEnd.setUTCHours(windowEnd.getUTCHours() + 36);

    // Phase 7: 'pending' is the explicit "needs a cleaner" status (it
    // implies cleaner_id is null and the job isn't terminal). Using the
    // status filter is more correct than `cleaner_id is null` because a
    // completed job that gets unassigned would otherwise resurface here.
    const { data: jobs, error: jobsErr } = await admin
      .from("cleaning_jobs")
      .select("id, scheduled_start, property:properties(name, nickname)")
      .eq("status", "pending")
      .gte("scheduled_start", windowStart.toISOString())
      .lt("scheduled_start", windowEnd.toISOString());
    if (jobsErr) throw jobsErr;

    const todaysJobs = (jobs ?? []).filter((j) => ptDateString(new Date(j.scheduled_start)) === today);

    if (todaysJobs.length === 0) {
      return json({ ok: true, today, unassigned: 0, sent: 0 });
    }

    // Managers with a phone on file.
    const { data: managerRoles, error: rolesErr } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "manager");
    if (rolesErr) throw rolesErr;
    const managerIds = (managerRoles ?? []).map((r) => r.user_id as string);

    if (managerIds.length === 0) {
      return json({ ok: true, today, unassigned: todaysJobs.length, sent: 0, reason: "no managers" });
    }

    const { data: managers, error: profErr } = await admin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", managerIds)
      .not("phone", "is", null);
    if (profErr) throw profErr;

    const recipients = (managers ?? []).filter((m) => (m.phone ?? "").trim() !== "");
    if (recipients.length === 0) {
      return json({ ok: true, today, unassigned: todaysJobs.length, sent: 0, reason: "no managers with phone" });
    }

    // Compose message.
    const propNames = todaysJobs
      .map((j) => {
        const p = j.property as { name?: string; nickname?: string } | null;
        return p?.nickname || p?.name || "a property";
      })
      .filter((v, i, arr) => arr.indexOf(v) === i); // dedupe
    const preview = propNames.slice(0, 3).join(", ");
    const more = propNames.length > 3 ? `, +${propNames.length - 3} more` : "";
    const count = todaysJobs.length;
    const msg = `CleanOS: ${count} unassigned cleaning${count === 1 ? "" : "s"} today (${preview}${more}). Assign in CleanOS.`;

    let sent = 0;
    const errors: string[] = [];
    for (const m of recipients) {
      const r = await sendSms(m.phone!, msg);
      if (r.ok) sent++;
      else errors.push(`${m.full_name ?? m.id}: ${r.error}`);
    }

    return json({ ok: true, today, unassigned: count, sent, errors });
  } catch (e) {
    console.error("notify-unassigned-jobs error", e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

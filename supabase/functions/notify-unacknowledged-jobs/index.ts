// Edge function: hourly check for assigned-but-unacknowledged jobs.
//
// Invoked by pg_cron every hour at :00 UTC. Looks for jobs in status
// 'assigned' whose scheduled_start is within the next 24 hours and texts
// the cleaner a reminder to acknowledge.
//
// Dedupe: we only send a reminder if no earlier reminder has been sent for
// the same job. The reminder is tracked by inserting a row into the
// existing job_status_log with notes='acknowledge_reminder_sent'. This is
// a slight overload of the audit log table but avoids adding another
// dedupe table for a single-purpose nudge. The trigger only fires on
// status change, so writing a no-status-change log row via the admin
// client requires a direct insert — which RLS allows because the admin
// client uses the service role.
//
// Quiet hours: only sends between 8am and 8pm in America/Los_Angeles, so
// cleaners aren't woken up at 3am. (Cron still fires every hour; we just
// skip the send during quiet hours.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSms } from "../_shared/sms.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ptHour(d: Date): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return parseInt(h, 10);
}

function ptDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const now = new Date();
    const hour = ptHour(now);
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    // Quiet hours: 8pm-7:59am PT. Skip unless forced.
    if (!force && (hour < 8 || hour >= 20)) {
      return json({ ok: true, skipped: true, reason: `quiet hours (${hour}:xx PT)` });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Assigned jobs starting in the next 24h.
    const { data: jobs, error: jobsErr } = await admin
      .from("cleaning_jobs")
      .select("id, scheduled_start, cleaner_id, property:properties(name, nickname), cleaner:profiles!cleaning_jobs_cleaner_id_fkey(full_name, phone)")
      .eq("status", "assigned")
      .not("cleaner_id", "is", null)
      .gte("scheduled_start", now.toISOString())
      .lt("scheduled_start", windowEnd.toISOString());
    if (jobsErr) throw jobsErr;

    const candidates = jobs ?? [];
    if (candidates.length === 0) {
      return json({ ok: true, candidates: 0, sent: 0 });
    }

    // Dedupe: pull any prior reminder log rows for these jobs.
    const jobIds = candidates.map((j) => j.id);
    const { data: prior, error: priorErr } = await admin
      .from("job_status_log")
      .select("job_id")
      .in("job_id", jobIds)
      .eq("notes", "acknowledge_reminder_sent");
    if (priorErr) throw priorErr;
    const alreadyNotified = new Set((prior ?? []).map((r) => r.job_id as string));

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const j of candidates) {
      if (alreadyNotified.has(j.id)) {
        skipped++;
        continue;
      }
      const cleaner = j.cleaner as { full_name?: string; phone?: string } | null;
      const phone = (cleaner?.phone ?? "").trim();
      if (!phone) {
        skipped++;
        continue;
      }
      const property = j.property as { name?: string; nickname?: string } | null;
      const propName = property?.nickname || property?.name || "a property";
      const when = ptDateTime(j.scheduled_start);
      const msg = `CleanOS: Reminder — you have a clean at ${propName} ${when}. Open the app to acknowledge it.`;

      const r = await sendSms(phone, msg);
      if (r.ok) {
        sent++;
        // Mark as notified by appending a log row (status doesn't change).
        await admin.from("job_status_log").insert({
          job_id: j.id,
          from_status: "assigned",
          to_status: "assigned",
          changed_by: null,
          notes: "acknowledge_reminder_sent",
        });
      } else {
        errors.push(`${cleaner?.full_name ?? j.cleaner_id}: ${r.error}`);
      }
    }

    return json({ ok: true, candidates: candidates.length, sent, skipped, errors });
  } catch (e) {
    console.error("notify-unacknowledged-jobs error", e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

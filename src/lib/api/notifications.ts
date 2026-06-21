// Phase 4 — SMS notification helpers (client-side).
//
// Each helper composes a one-line message and invokes the `send-sms` edge
// function. Calls are fire-and-forget: failures are logged but never thrown,
// because UX should not depend on Twilio.

import { supabase } from "@/integrations/supabase/client";

async function sendSms(to: string, body: string): Promise<void> {
  if (!to || !to.trim()) return;
  try {
    const { error } = await supabase.functions.invoke("send-sms", {
      body: { to, body },
    });
    if (error) console.warn("send-sms failed", { to, error });
  } catch (e) {
    console.warn("send-sms threw", { to, e });
  }
}

async function fetchCleanerPhone(cleanerId: string): Promise<{ phone: string | null; name: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("phone, full_name")
    .eq("id", cleanerId)
    .maybeSingle();
  if (error || !data) return { phone: null, name: null };
  return { phone: data.phone, name: data.full_name };
}

async function fetchManagerPhones(): Promise<string[]> {
  const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "manager");
  const ids = (roles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("phone")
    .in("id", ids)
    .not("phone", "is", null);
  return (profiles ?? []).map((p) => p.phone as string).filter((p) => p && p.trim() !== "");
}

function formatJobDate(scheduledStart: string | null | undefined): string {
  if (!scheduledStart) return "TBD";
  try {
    return new Date(scheduledStart).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "TBD";
  }
}

export type JobNotifyContext = {
  propertyName: string;
  scheduledStart: string | null | undefined;
};

export async function notifyCleanerAssigned(
  cleanerId: string,
  ctx: JobNotifyContext,
): Promise<void> {
  const { phone } = await fetchCleanerPhone(cleanerId);
  if (!phone) return;
  const when = formatJobDate(ctx.scheduledStart);
  // Invite, not a fait accompli: the cleaner accepts or declines in the app
  // (and, once A2P clears, by replying Y/N).
  await sendSms(phone, `Turnpoint: New cleaning invite — ${ctx.propertyName} on ${when}. Open Turnpoint to Accept or Decline. Reply STOP to opt out.`);
}

export async function notifyCleanerUnassigned(
  cleanerId: string,
  ctx: JobNotifyContext,
): Promise<void> {
  const { phone } = await fetchCleanerPhone(cleanerId);
  if (!phone) return;
  const when = formatJobDate(ctx.scheduledStart);
  await sendSms(phone, `CleanOS: Your ${when} cleaning at ${ctx.propertyName} has been reassigned. No action needed.`);
}

export async function notifyCleanerDateChanged(
  cleanerId: string,
  ctx: JobNotifyContext,
): Promise<void> {
  const { phone } = await fetchCleanerPhone(cleanerId);
  if (!phone) return;
  const when = formatJobDate(ctx.scheduledStart);
  await sendSms(phone, `CleanOS: Your cleaning at ${ctx.propertyName} has been rescheduled to ${when}.`);
}

export async function notifyManagersJobCompleted(ctx: JobNotifyContext & { cleanerName: string | null }): Promise<void> {
  const phones = await fetchManagerPhones();
  if (phones.length === 0) return;
  const when = formatJobDate(ctx.scheduledStart);
  const who = ctx.cleanerName ? ` by ${ctx.cleanerName}` : "";
  const msg = `CleanOS: ${ctx.propertyName} cleaning${who} completed (${when}). Ready for your review.`;
  await Promise.all(phones.map((p) => sendSms(p, msg)));
}

export async function notifyManagersJobAcknowledged(ctx: JobNotifyContext & { cleanerName: string | null }): Promise<void> {
  const phones = await fetchManagerPhones();
  if (phones.length === 0) return;
  const when = formatJobDate(ctx.scheduledStart);
  const who = ctx.cleanerName ? `${ctx.cleanerName} ` : "Cleaner ";
  const msg = `CleanOS: ${who}acknowledged ${ctx.propertyName} (${when}).`;
  await Promise.all(phones.map((p) => sendSms(p, msg)));
}

export async function notifyManagersJobDeclined(ctx: JobNotifyContext & { cleanerName: string | null }): Promise<void> {
  const phones = await fetchManagerPhones();
  if (phones.length === 0) return;
  const when = formatJobDate(ctx.scheduledStart);
  const who = ctx.cleanerName ? `${ctx.cleanerName} ` : "A cleaner ";
  const msg = `Turnpoint: ${who}DECLINED ${ctx.propertyName} (${when}). It's back to unassigned — reassign in Turnpoint.`;
  await Promise.all(phones.map((p) => sendSms(p, msg)));
}

export async function notifyManagersJobStarted(ctx: JobNotifyContext & { cleanerName: string | null }): Promise<void> {
  const phones = await fetchManagerPhones();
  if (phones.length === 0) return;
  const when = formatJobDate(ctx.scheduledStart);
  const who = ctx.cleanerName ? `${ctx.cleanerName} ` : "Cleaner ";
  const msg = `CleanOS: ${who}started ${ctx.propertyName} (${when}).`;
  await Promise.all(phones.map((p) => sendSms(p, msg)));
}

export async function notifyCleanerJobApproved(
  cleanerId: string,
  ctx: JobNotifyContext,
): Promise<void> {
  const { phone } = await fetchCleanerPhone(cleanerId);
  if (!phone) return;
  const when = formatJobDate(ctx.scheduledStart);
  await sendSms(phone, `CleanOS: Your ${when} cleaning at ${ctx.propertyName} was approved. Nice work!`);
}

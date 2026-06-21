// Shared Twilio SMS helper (Deno).
//
// sendSms() silently no-ops when Twilio creds are missing — by design, so
// the rest of the app can fire-and-forget without crashing in dev/test.
// Set these Supabase function secrets to enable real sends:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_NUMBER   (E.164, e.g. +14155551234)

export type SendSmsResult =
  | { ok: true; sid: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

// Normalize a US phone number to E.164. Accepts:
//   "(555) 123-4567"   -> "+15551234567"
//   "555-123-4567"     -> "+15551234567"
//   "15551234567"      -> "+15551234567"
//   "+15551234567"     -> "+15551234567"  (passthrough)
// Returns null if the input can't be confidently normalized.
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already E.164-ish
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendSms(rawTo: string, body: string): Promise<SendSmsResult> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");

  if (!sid || !token || !from) {
    console.log("send-sms: Twilio creds unset, skipping", { to: rawTo, bodyPreview: body.slice(0, 60) });
    return { ok: true, skipped: true, reason: "twilio creds unset" };
  }

  const to = normalizePhone(rawTo);
  if (!to) return { ok: false, error: `invalid phone: ${rawTo}` };

  const payload = new URLSearchParams({ To: to, From: from, Body: body });
  const auth = btoa(`${sid}:${token}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("twilio send failed", { status: res.status, body: text });
    return { ok: false, error: `twilio ${res.status}: ${text}` };
  }

  const json = await res.json();
  return { ok: true, sid: json.sid as string };
}

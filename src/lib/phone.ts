// Phone-number helpers for the client. Mirrors the server-side normalizer
// in supabase/functions/_shared/sms.ts so the UI can show users whether
// the value they typed will actually deliver via Twilio.

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

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

// Pretty-print an E.164 US number as (XXX) XXX-XXXX for display.
// Returns the raw value if not a US number we know how to format.
export function formatUsPhone(e164: string | null): string {
  if (!e164) return "";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

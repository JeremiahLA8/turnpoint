// Shared Dwolla ACH client for Deno edge functions (Phase 2 crew disbursement).
//
// Auth is OAuth2 client_credentials (an app token), much simpler than QB — no
// per-user grant. The environment ('sandbox' | 'production') picks the base URL;
// everything else is identical, so sandbox-tested code ships to production by
// swapping keys + flipping the env.
//
// Pure helpers (amountToDecimalString, hmac/webhook verify) have no runtime deps
// beyond Web Crypto (present in Deno + Node 18+), so the app's vitest suite
// imports and tests them directly. I/O helpers use only `fetch` + `btoa`.

const BASE = {
  sandbox: { api: "https://api-sandbox.dwolla.com" },
  production: { api: "https://api.dwolla.com" },
} as const;

export type DwollaEnv = keyof typeof BASE;
const HAL = "application/vnd.dwolla.v1.hal+json";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

// Dwolla transfer amounts are decimal strings ("200.00"), not cents.
export function amountToDecimalString(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) throw new Error(`bad amount: ${cents}`);
  return (Math.round(cents) / 100).toFixed(2);
}

// A stable idempotency key for a payout so a retry never double-sends.
export function transferIdempotencyKey(payoutId: string): string {
  return `payout-${payoutId}`;
}

// Map a Dwolla webhook topic to our payout status. Dwolla has many transfer
// topic variants (transfer_*, customer_transfer_*, customer_bank_transfer_*),
// so we match on the meaningful suffix rather than enumerate them all. Returns
// null for topics we don't track (so the webhook ignores them).
export function transferTopicToStatus(
  topic: string,
): "pending" | "processed" | "failed" | "cancelled" | "returned" | null {
  const t = topic.toLowerCase();
  if (!t.includes("transfer")) return null;
  if (t.includes("completed")) return "processed";
  if (t.includes("failed")) return "failed";
  if (t.includes("cancelled") || t.includes("canceled")) return "cancelled";
  if (t.includes("returned")) return "returned";
  if (t.includes("created")) return "pending";
  return null;
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Sign a webhook body the way Dwolla does — exported so the unit test can
// round-trip against verifyWebhookSignature without a hardcoded vector.
export function signWebhookBody(secret: string, body: string): Promise<string> {
  return hmacSha256Hex(secret, body);
}

// Verify Dwolla's X-Request-Signature-SHA-256 header (HMAC-SHA256 hex of the
// raw body with the webhook subscription secret). Constant-time compare.
export async function verifyWebhookSignature(
  secret: string,
  body: string,
  headerSignature: string | null,
): Promise<boolean> {
  if (!headerSignature) return false;
  const expected = await hmacSha256Hex(secret, body);
  if (expected.length !== headerSignature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ headerSignature.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// I/O helpers (live calls)
// ---------------------------------------------------------------------------

export type DwollaAuth = { key: string; secret: string; env: DwollaEnv };

export type DwollaSession = { accessToken: string; api: string };

export async function getToken(auth: DwollaAuth): Promise<DwollaSession> {
  const api = BASE[auth.env].api;
  const basic = btoa(`${auth.key}:${auth.secret}`);
  const res = await fetch(`${api}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`Dwolla token failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { accessToken: json.access_token as string, api };
}

// Dwolla returns the created resource's URL in the Location header.
async function post(
  s: DwollaSession,
  path: string,
  body: unknown,
  idempotencyKey?: string,
): Promise<{ location: string | null; json: any }> {
  const res = await fetch(`${s.api}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.accessToken}`,
      "Content-Type": HAL,
      Accept: HAL,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dwolla POST ${path} failed: ${res.status} ${text}`);
  return { location: res.headers.get("Location"), json: text ? JSON.parse(text) : {} };
}

// The Dwolla Account id (the business itself — the source of funds).
export async function getAccountId(s: DwollaSession): Promise<string> {
  const root = await getResource(s, `${s.api}/`);
  const href = root?._links?.account?.href as string | undefined;
  const id = idFromUrl(href ?? null);
  if (!id) throw new Error("Dwolla: could not resolve account id");
  return id;
}

// Pick the account's verified BANK funding source — what payouts are sent from.
// Auto-discovery means no manual config: in production it selects Ascend's
// verified bank the moment it's added in the Dwolla dashboard.
export async function findVerifiedBankFundingSource(
  s: DwollaSession,
  accountId: string,
): Promise<{ id: string; name: string } | null> {
  const r = await getResource(s, `${s.api}/accounts/${accountId}/funding-sources`);
  const list = (r?._embedded?.["funding-sources"] ?? []) as any[];
  const bank = list.find((f) => f.type === "bank" && f.status === "verified" && !f.removed);
  return bank ? { id: bank.id, name: bank.name } : null;
}

export async function getResource(s: DwollaSession, url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${s.accessToken}`, Accept: HAL },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dwolla GET ${url} failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

const idFromUrl = (url: string | null) => (url ? url.split("/").pop() ?? null : null);

// A "receive-only" customer — the cleaner. They can receive funds without
// completing Dwolla's full identity verification.
export async function createReceiveOnlyCustomer(
  s: DwollaSession,
  c: { firstName: string; lastName: string; email: string; businessName?: string },
): Promise<string> {
  const { location } = await post(s, "/customers", {
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    type: "receive-only",
    ...(c.businessName ? { businessName: c.businessName } : {}),
  });
  const id = idFromUrl(location);
  if (!id) throw new Error("Dwolla customer create returned no id");
  return id;
}

// Attach a bank account to a customer via routing + account number. Returns the
// funding source id + last4. Raw numbers go to Dwolla only; we persist neither.
export async function createBankFundingSource(
  s: DwollaSession,
  customerId: string,
  bank: { routingNumber: string; accountNumber: string; bankAccountType: "checking" | "savings"; name: string },
): Promise<{ fundingSourceId: string; last4: string }> {
  const { location } = await post(s, `/customers/${customerId}/funding-sources`, {
    routingNumber: bank.routingNumber,
    accountNumber: bank.accountNumber,
    bankAccountType: bank.bankAccountType,
    name: bank.name,
  });
  const id = idFromUrl(location);
  if (!id) throw new Error("Dwolla funding source create returned no id");
  return { fundingSourceId: id, last4: bank.accountNumber.slice(-4) };
}

// Move money from Ascend's funding source -> the cleaner's funding source.
export async function createTransfer(
  s: DwollaSession,
  t: { sourceFundingSourceId: string; destFundingSourceId: string; amountCents: number; idempotencyKey: string },
): Promise<{ transferId: string }> {
  const { location } = await post(
    s,
    "/transfers",
    {
      _links: {
        source: { href: `${s.api}/funding-sources/${t.sourceFundingSourceId}` },
        destination: { href: `${s.api}/funding-sources/${t.destFundingSourceId}` },
      },
      amount: { currency: "USD", value: amountToDecimalString(t.amountCents) },
    },
    t.idempotencyKey,
  );
  const id = idFromUrl(location);
  if (!id) throw new Error("Dwolla transfer create returned no id");
  return { transferId: id };
}

export async function getTransferStatus(s: DwollaSession, transferId: string): Promise<string> {
  const r = await getResource(s, `${s.api}/transfers/${transferId}`);
  return r.status as string;
}

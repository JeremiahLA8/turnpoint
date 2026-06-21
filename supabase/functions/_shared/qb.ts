// Shared QuickBooks Online client for Deno edge functions.
//
// Reuses Ascend's existing Intuit app (the same OAuth app the second-brain
// read/write scripts use), but with its OWN refresh token so cleanos never
// clobbers that token store. client_id/secret/realm come from Supabase secrets;
// the rotating refresh token lives in the `qb_connection` table (the edge
// function persists each rotation).
//
// The PURE helpers (mapMethodToPaymentType, buildPurchasePayload, qbEscape) have
// zero runtime deps so the app's vitest suite imports and tests them directly.
// The I/O helpers use only `fetch` + `btoa`, both present in Deno and Node 18+.

const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_API = "https://quickbooks.api.intuit.com/v3/company";
const MINOR = "70";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

// Escape a string for embedding in a QBO SQL-ish query literal.
export function qbEscape(s: string): string {
  return s.replace(/'/g, "\\'");
}

// QBO Purchase requires a PaymentType. We pay the crew electronically (Zelle,
// Venmo, QuickBooks) or by check; everything that isn't a check books cleanest
// as a Cash-type Purchase debiting the bank account (the bank feed then matches
// the real debit). Card payouts, if ever used, map to CreditCard.
export function mapMethodToPaymentType(
  method: string | null | undefined,
): "Check" | "Cash" | "CreditCard" {
  switch ((method ?? "").toLowerCase()) {
    case "check":
      return "Check";
    case "credit":
    case "creditcard":
    case "card":
      return "CreditCard";
    default:
      return "Cash";
  }
}

export type QbRef = { value: string; name?: string };

export type PurchaseRefs = {
  paymentAccountRef: QbRef; // bank/CC account the money left
  expenseAccountRef: QbRef; // "Cleaning - Crew"
  classRef?: QbRef | null; // "Cleaning Ops" (null when class tracking is off)
  vendorRef?: QbRef | null; // the cleaner, as a QB vendor
  customerRef?: QbRef | null; // the property (tracking only, not billable)
};

export type PayoutForBooking = {
  jobId: string;
  amountCents: number;
  method: string | null;
  paidAtISO: string; // when the cleaner was paid
  cleanerName: string;
  propertyLabel: string | null;
  cleanDateISO: string | null; // the date of the clean (for the memo)
};

// Build the QBO Purchase (cash/check expense) JSON. Books the amount to the
// dedicated "Cleaning - Crew" expense account, tagged with the "Cleaning Ops"
// class (when present) and the property as a tracking customer (NotBillable —
// owner reimbursement is handled separately by the /reimburse invoice flow, so
// we never double-bill here). The cleanos job id is stamped in the memo so a
// transaction is always traceable back to the clean.
export function buildPurchasePayload(p: PayoutForBooking, refs: PurchaseRefs) {
  const amount = Math.round(p.amountCents) / 100;
  const txnDate = p.paidAtISO.slice(0, 10); // YYYY-MM-DD
  const memoParts = [
    `Crew payout — ${p.cleanerName}`,
    p.propertyLabel ? `@ ${p.propertyLabel}` : null,
    p.cleanDateISO ? `(clean ${p.cleanDateISO.slice(0, 10)})` : null,
    `[cleanos job ${p.jobId}]`,
  ].filter((x): x is string => Boolean(x));

  const lineDetail: Record<string, unknown> = {
    AccountRef: refs.expenseAccountRef,
  };
  if (refs.classRef) lineDetail.ClassRef = refs.classRef;
  if (refs.customerRef) {
    lineDetail.CustomerRef = refs.customerRef;
    lineDetail.BillableStatus = "NotBillable";
  }

  const payload: Record<string, unknown> = {
    PaymentType: mapMethodToPaymentType(p.method),
    AccountRef: refs.paymentAccountRef,
    TxnDate: txnDate,
    TotalAmt: amount,
    PrivateNote: memoParts.join(" "),
    Line: [
      {
        DetailType: "AccountBasedExpenseLineDetail",
        Amount: amount,
        Description: memoParts.slice(0, 3).join(" "),
        AccountBasedExpenseLineDetail: lineDetail,
      },
    ],
  };
  if (refs.vendorRef) {
    payload.EntityRef = { value: refs.vendorRef.value, name: refs.vendorRef.name, type: "Vendor" };
  }
  return payload;
}

// ---------------------------------------------------------------------------
// I/O helpers (live calls — exercised against QB, not in unit tests)
// ---------------------------------------------------------------------------

export type QbAuth = { clientId: string; clientSecret: string };
export type QbSession = { accessToken: string; realmId: string };

export type RefreshResult = {
  accessToken: string;
  refreshToken: string; // rotated — persist this
  expiresInSec: number;
};

// Exchange the stored refresh token for a fresh access token. Intuit rotates
// the refresh token on every call, so the caller MUST persist `refreshToken`.
export async function refreshAccessToken(
  auth: QbAuth,
  refreshToken: string,
): Promise<RefreshResult> {
  const basic = btoa(`${auth.clientId}:${auth.clientSecret}`);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QB token refresh failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token as string,
    expiresInSec: (json.expires_in as number) ?? 3600,
  };
}

async function qbFetch(
  session: QbSession,
  path: string,
  init?: RequestInit,
): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${QB_API}/${session.realmId}/${path}${sep}minorversion=${MINOR}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`QB ${init?.method ?? "GET"} ${path} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

export async function qbQuery(session: QbSession, query: string): Promise<any> {
  return qbFetch(session, `query?query=${encodeURIComponent(query)}`);
}

// Resolve a bank/credit account by exact name. Returns null if not found —
// the payment account is required config, so the caller errors on null.
export async function findAccountByName(
  session: QbSession,
  name: string,
): Promise<QbRef | null> {
  const r = await qbQuery(
    session,
    `select Id, Name from Account where Name = '${qbEscape(name)}'`,
  );
  const a = r?.QueryResponse?.Account?.[0];
  return a ? { value: a.Id, name: a.Name } : null;
}

// Resolve the expense account by name, creating it (Expense / SuppliesMaterials)
// if it doesn't exist yet — so first run is zero-setup.
export async function findOrCreateExpenseAccount(
  session: QbSession,
  name: string,
): Promise<QbRef> {
  const existing = await findAccountByName(session, name);
  if (existing) return existing;
  const created = await qbFetch(session, "account", {
    method: "POST",
    body: JSON.stringify({
      Name: name,
      AccountType: "Expense",
      AccountSubType: "SuppliesMaterials",
    }),
  });
  const a = created?.Account;
  return { value: a.Id, name: a.Name };
}

// Resolve a Class by name, creating it if absent. Returns null when class
// tracking is disabled on the company (QBO rejects Class ops) so booking can
// proceed without a class rather than failing.
export async function findOrCreateClass(
  session: QbSession,
  name: string,
): Promise<QbRef | null> {
  try {
    const r = await qbQuery(
      session,
      `select Id, Name from Class where Name = '${qbEscape(name)}'`,
    );
    const c = r?.QueryResponse?.Class?.[0];
    if (c) return { value: c.Id, name: c.Name };
    const created = await qbFetch(session, "class", {
      method: "POST",
      body: JSON.stringify({ Name: name }),
    });
    const nc = created?.Class;
    return { value: nc.Id, name: nc.Name };
  } catch (e) {
    console.warn("QB class resolve/create failed (class tracking off?) — booking without class", e);
    return null;
  }
}

// Resolve a vendor by display name, creating it if absent.
export async function findOrCreateVendor(
  session: QbSession,
  displayName: string,
): Promise<QbRef | null> {
  const safe = qbEscape(displayName);
  const r = await qbQuery(
    session,
    `select Id, DisplayName from Vendor where DisplayName = '${safe}'`,
  );
  const v = r?.QueryResponse?.Vendor?.[0];
  if (v) return { value: v.Id, name: v.DisplayName };
  try {
    const created = await qbFetch(session, "vendor", {
      method: "POST",
      body: JSON.stringify({ DisplayName: displayName }),
    });
    const nv = created?.Vendor;
    return { value: nv.Id, name: nv.DisplayName };
  } catch (e) {
    console.warn("QB vendor create failed — booking without a payee", e);
    return null;
  }
}

// Resolve a customer (the property) by display name for expense tracking.
// Best-effort: a missing match just means the expense isn't customer-tagged.
export async function findCustomerByName(
  session: QbSession,
  name: string,
): Promise<QbRef | null> {
  const safe = qbEscape(name);
  let r = await qbQuery(
    session,
    `select Id, DisplayName from Customer where DisplayName = '${safe}'`,
  );
  let c = r?.QueryResponse?.Customer?.[0];
  if (!c) {
    r = await qbQuery(
      session,
      `select Id, DisplayName from Customer where DisplayName LIKE '%${safe}%'`,
    );
    c = r?.QueryResponse?.Customer?.[0];
  }
  return c ? { value: c.Id, name: c.DisplayName } : null;
}

export async function createPurchase(
  session: QbSession,
  payload: Record<string, unknown>,
): Promise<{ id: string; docNumber?: string }> {
  const res = await qbFetch(session, "purchase", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const p = res?.Purchase;
  return { id: p.Id, docNumber: p.DocNumber };
}

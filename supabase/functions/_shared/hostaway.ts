// Shared Hostaway API client (Deno).
// Docs: https://api.hostaway.com/documentation
//
// Auth: OAuth2 client credentials. Account ID is the client_id; the API key
// generated in Hostaway dashboard (Settings -> Hostaway API) is client_secret.
// Tokens are valid for 24 months. We cache the token in-module so warm
// invocations skip the token round-trip.

const HOSTAWAY_BASE = "https://api.hostaway.com/v1";

let cachedToken: { token: string; expiresAt: number } | null = null;

// In-app onboarding can inject a customer's credentials (stored in hostaway_config)
// at runtime, overriding the env defaults. Setting creds resets the token cache.
let overrideCreds: { accountId: string; clientSecret: string } | null = null;
export function setHostawayCreds(creds: { accountId: string; clientSecret: string } | null) {
  overrideCreds = creds;
  cachedToken = null;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const accountId = overrideCreds?.accountId ?? Deno.env.get("HOSTAWAY_ACCOUNT_ID");
  const clientSecret = overrideCreds?.clientSecret ?? Deno.env.get("HOSTAWAY_CLIENT_SECRET");
  if (!accountId || !clientSecret) {
    throw new Error("Hostaway credentials missing — connect Hostaway or set HOSTAWAY_ACCOUNT_ID and HOSTAWAY_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: accountId,
    client_secret: clientSecret,
    scope: "general",
  });

  const res = await fetch(`${HOSTAWAY_BASE}/accessTokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hostaway token request failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  const token = json.access_token as string;
  // expires_in is seconds; default to 24h if missing (real value is ~63072000s).
  const expiresIn = (json.expires_in as number) ?? 86_400;
  cachedToken = { token, expiresAt: now + expiresIn * 1000 };
  return token;
}

type HostawayResponse<T> = { status: string; result: T };

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${HOSTAWAY_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hostaway GET ${path} failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as HostawayResponse<T>;
  return json.result;
}

// ---- Domain types (subset of what we use) ----

export type HostawayListing = {
  id: number;
  name?: string;
  externalListingName?: string;
  internalListingName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
  bedroomsNumber?: number;
  bathroomsNumber?: number;
  personCapacity?: number;
  squareMeters?: number | null;
};

export type HostawayReservation = {
  id: number;
  listingMapId: number;
  guestName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  arrivalDate?: string;   // YYYY-MM-DD
  departureDate?: string; // YYYY-MM-DD
  status?: string;         // "new" | "modified" | "cancelled" | "ownerStay" etc.
  isCancelled?: boolean | 0 | 1;
};

// ---- Public methods ----

export async function listListings(): Promise<HostawayListing[]> {
  // Hostaway paginates with limit/offset; default limit is 100. Pull all.
  const all: HostawayListing[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const page = await apiGet<HostawayListing[]>("/listings", {
      limit: String(limit),
      offset: String(offset),
    });
    all.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }
  return all;
}

export async function listReservations(opts: {
  fromArrivalDate?: string; // YYYY-MM-DD
  toArrivalDate?: string;   // YYYY-MM-DD
}): Promise<HostawayReservation[]> {
  const all: HostawayReservation[] = [];
  let offset = 0;
  const limit = 200;
  while (true) {
    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
    };
    if (opts.fromArrivalDate) params.arrivalStartDate = opts.fromArrivalDate;
    if (opts.toArrivalDate) params.arrivalEndDate = opts.toArrivalDate;
    const page = await apiGet<HostawayReservation[]>("/reservations", params);
    all.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }
  return all;
}

// ---- Mappers (Hostaway -> CleanOS rows) ----

const PROPERTY_COLORS = [
  "bg-rose-200 text-rose-900",
  "bg-amber-200 text-amber-900",
  "bg-emerald-200 text-emerald-900",
  "bg-sky-200 text-sky-900",
  "bg-violet-200 text-violet-900",
  "bg-pink-200 text-pink-900",
  "bg-teal-200 text-teal-900",
  "bg-orange-200 text-orange-900",
];

export function colorForListing(id: number): string {
  return PROPERTY_COLORS[id % PROPERTY_COLORS.length];
}

export function mapListingToProperty(l: HostawayListing) {
  const name = l.externalListingName || l.internalListingName || l.name || `Listing ${l.id}`;
  const addressParts = [l.address, l.city, l.state, l.zipcode].filter(Boolean);
  const address = addressParts.join(", ");
  // square meters -> sqft (1 m² ≈ 10.7639 sqft)
  const sqft = l.squareMeters ? Math.round(l.squareMeters * 10.7639) : 0;
  return {
    hostaway_listing_id: String(l.id),
    name,
    address,
    beds: l.bedroomsNumber ?? 0,
    baths: l.bathroomsNumber ?? 0,
    guests: l.personCapacity ?? 0,
    sqft,
    color: colorForListing(l.id),
  };
}

// Cleaning window defaults: starts at checkout time (11:00 UTC) and runs 4 hours.
// Property timezones aren't tracked yet — refine in Phase 3 if needed.
const CLEAN_START_HOUR_UTC = 11;
const CLEAN_DURATION_HOURS = 4;

export function mapReservationToJob(
  r: HostawayReservation,
  propertyId: string,
  defaultCleanerId: string | null,
) {
  if (!r.departureDate) return null;

  const cancelled =
    r.status === "cancelled" || r.isCancelled === true || r.isCancelled === 1;

  // Only confirmed stays produce a turnover clean. Hostaway also returns
  // inquiries, pending/awaiting-payment, declined and expired reservations —
  // none of those are a real guest checkout, so they must NOT create turns.
  // Cancelled stays still map through (so an existing turn gets cancelled),
  // but the sync won't insert a brand-new cancelled turn.
  const CONFIRMED_STAY = new Set(["new", "modified"]);
  if (!cancelled && !CONFIRMED_STAY.has(r.status ?? "")) return null;

  const start = new Date(`${r.departureDate}T00:00:00Z`);
  start.setUTCHours(CLEAN_START_HOUR_UTC, 0, 0, 0);
  const end = new Date(start);
  end.setUTCHours(end.getUTCHours() + CLEAN_DURATION_HOURS);

  // Phase 7 state machine: jobs land as 'pending' (no cleaner yet) or
  // 'assigned' (property has a default cleaner). The acknowledge step
  // happens after the cleaner sees the job in the app.
  const initialStatus = cancelled
    ? ("cancelled" as const)
    : defaultCleanerId
      ? ("assigned" as const)
      : ("pending" as const);

  return {
    hostaway_reservation_id: String(r.id),
    property_id: propertyId,
    cleaner_id: defaultCleanerId,
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    status: initialStatus,
    guest_name: r.guestName ?? ([r.guestFirstName, r.guestLastName].filter(Boolean).join(" ") || null),
    check_in: r.arrivalDate ?? null,
    check_out: r.departureDate ?? null,
  };
}

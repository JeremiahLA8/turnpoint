// Where a property lives — used to group/filter by area on the Readiness board
// (Today) and the crew-rates manager (Pay → Rates). Pure helpers, unit-tested.

import type { Property } from "@/lib/api/properties";

// Best-effort city parse from a free-text address ("123 Main St, Eugene, OR 97401").
export function cityOf(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const candidate = parts[parts.length - 2];
  if (!candidate || /\d/.test(candidate) || candidate.length > 24) return null;
  return candidate;
}

// Area for a property: prefer the explicit region field, fall back to a parsed city.
export function areaOf(p: Property): string | null {
  const region = (p as { region?: string | null }).region;
  return (region && region.trim()) || cityOf(p.address);
}

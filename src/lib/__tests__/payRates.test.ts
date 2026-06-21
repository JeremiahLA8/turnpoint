import { describe, it, expect } from "vitest";
import {
  buildRateIndex,
  effectivePayCents,
  rateKey,
  type PropertyCleanerRate,
} from "@/lib/api/payRates";

const rate = (property_id: string, cleaner_id: string, amount_cents: number): PropertyCleanerRate => ({
  id: `${property_id}-${cleaner_id}`,
  property_id,
  cleaner_id,
  amount_cents,
  created_at: "2026-06-14T00:00:00Z",
  updated_at: "2026-06-14T00:00:00Z",
});

const job = (over: Partial<{ property_id: string | null; cleaner_id: string | null; amount_cents: number | null }>) => ({
  property_id: "p1",
  cleaner_id: "c1",
  amount_cents: null,
  ...over,
});

describe("rateKey", () => {
  it("composes a stable property:cleaner key", () => {
    expect(rateKey("p1", "c1")).toBe("p1:c1");
  });
});

describe("buildRateIndex", () => {
  it("indexes rates by property:cleaner", () => {
    const idx = buildRateIndex([rate("p1", "c1", 6500), rate("p1", "c2", 9000)]);
    expect(idx.get("p1:c1")).toBe(6500);
    expect(idx.get("p1:c2")).toBe(9000);
    expect(idx.size).toBe(2);
  });

  it("handles undefined / empty", () => {
    expect(buildRateIndex(undefined).size).toBe(0);
    expect(buildRateIndex([]).size).toBe(0);
  });
});

describe("effectivePayCents", () => {
  const idx = buildRateIndex([rate("p1", "c1", 6500)]);

  it("uses the configured (property, cleaner) rate when no override", () => {
    expect(effectivePayCents(job({}), idx)).toBe(6500);
  });

  it("lets a per-job override win over the rate", () => {
    expect(effectivePayCents(job({ amount_cents: 12000 }), idx)).toBe(12000);
  });

  it("treats a zero override as a real value, not 'unset'", () => {
    expect(effectivePayCents(job({ amount_cents: 0 }), idx)).toBe(0);
  });

  it("returns null (unpriced) when no rate and no override", () => {
    expect(effectivePayCents(job({ cleaner_id: "c2" }), idx)).toBeNull();
  });

  it("returns null when the job is unassigned (no cleaner)", () => {
    expect(effectivePayCents(job({ cleaner_id: null }), idx)).toBeNull();
  });

  it("returns null when the job has no property", () => {
    expect(effectivePayCents(job({ property_id: null }), idx)).toBeNull();
  });

  it("does not cross-apply one cleaner's rate to another at the same property", () => {
    const shared = buildRateIndex([rate("p1", "c1", 6500), rate("p1", "c2", 9000)]);
    expect(effectivePayCents(job({ cleaner_id: "c2" }), shared)).toBe(9000);
  });
});

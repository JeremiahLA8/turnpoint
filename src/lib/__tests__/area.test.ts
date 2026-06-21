import { describe, it, expect } from "vitest";
import { cityOf, areaOf } from "@/lib/area";
import type { Property } from "@/lib/api/properties";

const prop = (over: Partial<Property>): Property =>
  ({ id: "p", name: "Home", address: "", region: null, ...over } as Property);

describe("cityOf", () => {
  it("parses the city from a typical address", () => {
    expect(cityOf("123 Main St, Demo City, OR 97401")).toBe("Demo City");
  });
  it("returns null when there's no parseable city", () => {
    expect(cityOf(null)).toBeNull();
    expect(cityOf("123 Main St")).toBeNull();
  });
  it("rejects a numeric or overlong candidate", () => {
    expect(cityOf("123 Main St, 97401, OR")).toBeNull();
  });
});

describe("areaOf", () => {
  it("prefers the explicit region", () => {
    expect(areaOf(prop({ region: "Desert Valley", address: "1 A St, Demo City, OR" }))).toBe("Desert Valley");
  });
  it("falls back to the parsed city when region is blank", () => {
    expect(areaOf(prop({ region: "   ", address: "1 A St, Demo City, OR 97401" }))).toBe("Demo City");
    expect(areaOf(prop({ region: null, address: "1 A St, Demo City, OR 97401" }))).toBe("Demo City");
  });
});

import { describe, it, expect } from "vitest";
import { ROUTE_ROLES, canAccess, landingFor, type AppRole } from "@/lib/auth";

const ALL_ROLES: AppRole[] = ["admin", "manager", "technician", "client"];

// Expected access matrix (mirrors product spec). Keep this independent from
// ROUTE_ROLES so the test catches accidental edits to permissions.
const EXPECTED: Record<string, AppRole[]> = {
  "/today": ["admin", "manager"],
  "/run": ["admin", "technician"],
  "/pay": ["admin", "manager"],
  "/reports/owner": ["admin", "manager"],
  "/dashboard": ["admin", "manager", "technician"],
  "/cleaner-search": ["admin", "manager"],
  "/projects/schedule": ["admin", "manager", "technician"],
  "/projects/list": ["admin", "manager", "technician"],
  "/projects/reports": ["admin", "manager"],
  "/property-problems": ["admin", "manager", "technician", "client"],
  "/quality-center": ["admin", "manager"],
  "/payments": ["admin", "client"],
  "/properties": ["admin", "manager", "client"],
  "/check-in": ["admin", "manager"],
  "/checklists": ["admin", "manager", "technician"],
  "/inventory": ["admin", "manager"],
  "/my-team": ["admin", "manager"],
  "/guest-center": ["admin", "manager"],
  "/host-services": ["admin", "manager"],
  "/profile": ["admin", "manager", "technician", "client"],
};

describe("ROUTE_ROLES — coverage", () => {
  it("declares the same routes as the spec", () => {
    expect(Object.keys(ROUTE_ROLES).sort()).toEqual(Object.keys(EXPECTED).sort());
  });
});

describe("canAccess — full role × route matrix", () => {
  for (const [path, allowedRoles] of Object.entries(EXPECTED)) {
    for (const role of ALL_ROLES) {
      const shouldAllow = allowedRoles.includes(role);
      it(`${role} ${shouldAllow ? "CAN" : "cannot"} access ${path}`, () => {
        expect(canAccess([role], path)).toBe(shouldAllow);
      });
    }
  }
});

describe("canAccess — edge cases", () => {
  it("denies users with no roles on every route", () => {
    for (const path of Object.keys(EXPECTED)) {
      expect(canAccess([], path)).toBe(false);
    }
  });

  it("denies unknown routes", () => {
    for (const role of ALL_ROLES) {
      expect(canAccess([role], "/totally-made-up")).toBe(false);
    }
  });

  it("supports parent prefix paths (/projects, /checklists) for any role with one accessible child", () => {
    expect(canAccess(["technician"], "/projects")).toBe(true);   // schedule + list
    expect(canAccess(["client"], "/projects")).toBe(false);      // no children
    expect(canAccess(["technician"], "/checklists")).toBe(true);
    expect(canAccess(["client"], "/checklists")).toBe(false);
  });

  it("a user with multiple roles gets the union of permissions", () => {
    // technician alone can't see /payments, client alone can't see /dashboard
    expect(canAccess(["technician"], "/payments")).toBe(false);
    expect(canAccess(["client"], "/dashboard")).toBe(false);
    // combined → both allowed
    expect(canAccess(["technician", "client"], "/payments")).toBe(true);
    expect(canAccess(["technician", "client"], "/dashboard")).toBe(true);
  });
});

describe("landingFor", () => {
  it("routes each role to its expected landing page", () => {
    expect(landingFor(["admin"])).toBe("/today");
    expect(landingFor(["manager"])).toBe("/today");
    expect(landingFor(["technician"])).toBe("/run");
    expect(landingFor(["client"])).toBe("/properties");
  });

  it("respects role priority when a user has multiple", () => {
    expect(landingFor(["client", "admin"])).toBe("/today");
    expect(landingFor(["client", "technician"])).toBe("/run");
  });

  it("every landing route is actually accessible to that role", () => {
    for (const role of ALL_ROLES) {
      const landing = landingFor([role]);
      expect(canAccess([role], landing)).toBe(true);
    }
  });

  it("falls back to /dashboard for users with no roles", () => {
    expect(landingFor([])).toBe("/dashboard");
  });
});

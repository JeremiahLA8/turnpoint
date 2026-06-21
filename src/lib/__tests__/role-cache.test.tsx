import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import React from "react";

// ---- Mock the supabase client BEFORE importing auth ----
type AuthCb = (event: string, session: any) => void;
const authListeners: AuthCb[] = [];
let currentSession: any = null;

const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: AuthCb) => {
        authListeners.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getSession: () => Promise.resolve({ data: { session: currentSession } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    from: (...args: any[]) => fromMock(...args),
  },
}));

// Import AFTER the mock is registered.
import {
  AuthProvider,
  useAuth,
  clearRoleCache,
  type AppRole,
} from "@/lib/auth";

const ROLE_CACHE_KEY = "sweepr.roles.v1";
const TTL_MS = 5 * 60 * 1000;

const makeSession = (uid: string) => ({
  user: { id: uid, email: `${uid}@test.com` },
  access_token: "x",
});

const seedCache = (uid: string, roles: AppRole[], ts = Date.now()) => {
  localStorage.setItem(
    ROLE_CACHE_KEY,
    JSON.stringify({ uid, roles, ts }),
  );
};

const queryResolver = (rows: { role: AppRole }[]) => {
  // supabase.from("user_roles").select("role").eq("user_id", uid)
  // The auth code awaits the eq() call directly — return a thenable.
  return {
    select: () => ({
      eq: () =>
        Promise.resolve({ data: rows, error: null }),
    }),
  };
};

const Probe = ({ onRender }: { onRender: (v: ReturnType<typeof useAuth>) => void }) => {
  const v = useAuth();
  onRender(v);
  return null;
};

const renderWithAuth = (onRender: (v: ReturnType<typeof useAuth>) => void) =>
  render(
    <AuthProvider>
      <Probe onRender={onRender} />
    </AuthProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  authListeners.length = 0;
  currentSession = null;
  fromMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

const seedPersistedSession = (uid: string) => {
  // Mirrors the shape Supabase persists under "sb-<ref>-auth-token".
  localStorage.setItem(
    "sb-test-auth-token",
    JSON.stringify({ user: { id: uid }, access_token: "x" }),
  );
};

describe("role cache — restart persistence", () => {
  it("hydrates roles synchronously on first render from a persisted session (simulates browser restart)", async () => {
    const uid = "user-restart";
    seedPersistedSession(uid);
    seedCache(uid, ["admin"]);
    // No live session yet — getSession() will resolve later.
    currentSession = null;

    fromMock.mockReturnValue(queryResolver([{ role: "admin" }]));

    const snapshots: ReturnType<typeof useAuth>[] = [];
    renderWithAuth((v) => snapshots.push(v));

    // The very first snapshot should already contain cached roles.
    expect(snapshots[0].roles).toEqual(["admin"]);
  });

  it("does NOT hydrate from an expired cache after restart", async () => {
    const uid = "user-restart-expired";
    seedPersistedSession(uid);
    seedCache(uid, ["admin"], Date.now() - TTL_MS - 1000);
    currentSession = null;

    fromMock.mockReturnValue(queryResolver([{ role: "client" }]));

    const snapshots: ReturnType<typeof useAuth>[] = [];
    renderWithAuth((v) => snapshots.push(v));

    expect(snapshots[0].roles).toEqual([]);
  });
});


describe("role cache — hydration", () => {
  it("hydrates instantly from a fresh cache and revalidates in the background", async () => {
    const uid = "user-1";
    seedCache(uid, ["manager"]);
    currentSession = makeSession(uid);

    let bgResolve: (v: any) => void = () => {};
    fromMock.mockReturnValue({
      select: () => ({
        eq: () =>
          new Promise((res) => {
            bgResolve = res;
          }),
      }),
    });

    const snapshots: ReturnType<typeof useAuth>[] = [];
    renderWithAuth((v) => snapshots.push(v));

    // After mount, roles should hydrate from cache without resolving the fetch.
    await waitFor(() => {
      const last = snapshots[snapshots.length - 1];
      expect(last.loading).toBe(false);
      expect(last.roles).toEqual(["manager"]);
    });

    // Background revalidate now returns different roles -> state updates.
    await act(async () => {
      bgResolve({ data: [{ role: "admin" }], error: null });
    });

    await waitFor(() => {
      const last = snapshots[snapshots.length - 1];
      expect(last.roles).toEqual(["admin"]);
    });
    // Cache should be rewritten with fresh roles.
    const stored = JSON.parse(localStorage.getItem(ROLE_CACHE_KEY)!);
    expect(stored.roles).toEqual(["admin"]);
    expect(stored.uid).toBe(uid);
  });
});

describe("role cache — TTL expiry", () => {
  it("ignores an expired cache and fetches fresh roles", async () => {
    const uid = "user-ttl";
    // Seed cache with timestamp older than TTL.
    seedCache(uid, ["client"], Date.now() - TTL_MS - 1000);
    currentSession = makeSession(uid);

    fromMock.mockReturnValue(queryResolver([{ role: "technician" }]));

    const snapshots: ReturnType<typeof useAuth>[] = [];
    renderWithAuth((v) => snapshots.push(v));

    await waitFor(() => {
      const last = snapshots[snapshots.length - 1];
      expect(last.loading).toBe(false);
      expect(last.roles).toEqual(["technician"]);
    });

    // The expired cached value should NEVER have been surfaced as roles.
    const seenStale = snapshots.some(
      (s) => s.roles.length === 1 && s.roles[0] === "client",
    );
    expect(seenStale).toBe(false);
  });

  it("ignores cache belonging to a different user id", async () => {
    seedCache("someone-else", ["admin"]);
    const uid = "user-other";
    currentSession = makeSession(uid);

    fromMock.mockReturnValue(queryResolver([{ role: "client" }]));

    const snapshots: ReturnType<typeof useAuth>[] = [];
    renderWithAuth((v) => snapshots.push(v));

    await waitFor(() => {
      const last = snapshots[snapshots.length - 1];
      expect(last.loading).toBe(false);
      expect(last.roles).toEqual(["client"]);
    });

    const leaked = snapshots.some((s) => s.roles.includes("admin"));
    expect(leaked).toBe(false);
  });
});

describe("role cache — invalidation", () => {
  it("clearRoleCache() removes the persisted entry", () => {
    seedCache("u", ["admin"]);
    expect(localStorage.getItem(ROLE_CACHE_KEY)).not.toBeNull();
    clearRoleCache();
    expect(localStorage.getItem(ROLE_CACHE_KEY)).toBeNull();
  });

  it("clears the cache on sign-out", async () => {
    const uid = "user-out";
    seedCache(uid, ["manager"]);
    currentSession = makeSession(uid);
    fromMock.mockReturnValue(queryResolver([{ role: "manager" }]));

    let ctx: ReturnType<typeof useAuth> | null = null;
    renderWithAuth((v) => {
      ctx = v;
    });

    await waitFor(() => expect(ctx?.loading).toBe(false));
    expect(localStorage.getItem(ROLE_CACHE_KEY)).not.toBeNull();

    await act(async () => {
      await ctx!.signOut();
      // Simulate Supabase emitting SIGNED_OUT.
      authListeners.forEach((cb) => cb("SIGNED_OUT", null));
    });

    expect(localStorage.getItem(ROLE_CACHE_KEY)).toBeNull();
  });

  it("adopts a fresh same-user cache entry from another tab WITHOUT refetching (no ping-pong)", async () => {
    // Regression: two tabs open on the same URL caused an infinite refetch
    // loop. Every fetchRoles() writes the cache, fires `storage` in the other
    // tab, which used to unconditionally refetch and write — kicking off the
    // same cycle in the original tab. The UI flickered "loading" forever.
    // Now: when another tab writes a fresh entry for the SAME user, this tab
    // adopts it directly and does not refetch.
    const uid = "user-tab";
    seedCache(uid, ["manager"]);
    currentSession = makeSession(uid);

    let callCount = 0;
    fromMock.mockImplementation(() => {
      callCount++;
      return queryResolver([{ role: callCount === 1 ? "manager" : "admin" }]);
    });

    const snapshots: ReturnType<typeof useAuth>[] = [];
    renderWithAuth((v) => snapshots.push(v));

    // Initial hydrate (cached) + one background revalidate call.
    await waitFor(() => {
      expect(snapshots[snapshots.length - 1].loading).toBe(false);
      expect(callCount).toBeGreaterThanOrEqual(1);
    });
    const before = callCount;
    const snapshotsAfterHydrate = snapshots.length;

    // Simulate another tab writing a fresh cache entry for the same user.
    await act(async () => {
      const newPayload = JSON.stringify({
        uid,
        roles: ["admin"],
        ts: Date.now(),
      });
      localStorage.setItem(ROLE_CACHE_KEY, newPayload);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: ROLE_CACHE_KEY,
          newValue: newPayload,
        }),
      );
    });

    // Roles must update to the value the other tab wrote…
    await waitFor(() => {
      expect(snapshots[snapshots.length - 1].roles).toEqual(["admin"]);
    });
    // …but NO refetch was issued. This is the loop-breaker.
    expect(callCount).toBe(before);
    // And the UI never flipped back to loading after hydration.
    const post = snapshots.slice(snapshotsAfterHydrate - 1);
    expect(post.some((s) => s.loading)).toBe(false);
  });

  it("refetches when another tab clears the cache", async () => {
    const uid = "user-tab";
    seedCache(uid, ["manager"]);
    currentSession = makeSession(uid);

    let callCount = 0;
    fromMock.mockImplementation(() => {
      callCount++;
      return queryResolver([{ role: "admin" }]);
    });

    const snapshots: ReturnType<typeof useAuth>[] = [];
    renderWithAuth((v) => snapshots.push(v));

    await waitFor(() => {
      expect(snapshots[snapshots.length - 1].loading).toBe(false);
      expect(callCount).toBeGreaterThanOrEqual(1);
    });
    const before = callCount;

    // Another tab clears the cache (e.g. via sign-out).
    await act(async () => {
      localStorage.removeItem(ROLE_CACHE_KEY);
      window.dispatchEvent(
        new StorageEvent("storage", { key: ROLE_CACHE_KEY, newValue: null }),
      );
    });

    await waitFor(() => expect(callCount).toBeGreaterThan(before));
  });
});

describe("role cache — uid mismatch detection", () => {
  it("purges a stale cache for a different user and forces a fresh fetch on session apply", async () => {
    const uid = "user-current";
    // Cache belongs to a DIFFERENT user (e.g. previous account on this device).
    seedCache("user-other", ["admin"]);
    currentSession = makeSession(uid);

    let calls = 0;
    fromMock.mockImplementation(() => {
      calls++;
      return queryResolver([{ role: "client" }]);
    });

    const snapshots: ReturnType<typeof useAuth>[] = [];
    renderWithAuth((v) => snapshots.push(v));

    await waitFor(() => {
      const last = snapshots[snapshots.length - 1];
      expect(last.loading).toBe(false);
      expect(last.roles).toEqual(["client"]);
    });

    // The other user's roles must NEVER appear in any snapshot.
    expect(snapshots.some((s) => s.roles.includes("admin"))).toBe(false);
    // A network fetch must have happened (no cache hit).
    expect(calls).toBeGreaterThanOrEqual(1);
    // The persisted cache should now be the current user's roles.
    const stored = JSON.parse(localStorage.getItem(ROLE_CACHE_KEY)!);
    expect(stored.uid).toBe(uid);
    expect(stored.roles).toEqual(["client"]);
  });

  it("readRoleCache purges a mismatched entry as a side effect", async () => {
    seedCache("u-A", ["admin"]);
    // Importing the helper indirectly via a render isn't needed — just trigger
    // it through the public surface: render with a different session.
    currentSession = makeSession("u-B");
    fromMock.mockReturnValue(queryResolver([{ role: "manager" }]));

    let ctx: ReturnType<typeof useAuth> | null = null;
    renderWithAuth((v) => { ctx = v; });

    await waitFor(() => expect(ctx?.loading).toBe(false));

    const stored = JSON.parse(localStorage.getItem(ROLE_CACHE_KEY)!);
    expect(stored.uid).toBe("u-B");
    expect(stored.roles).toEqual(["manager"]);
  });
});

import { rolesEqual } from "@/lib/auth";

describe("rolesEqual", () => {
  it("treats role lists as order-independent sets", () => {
    expect(rolesEqual(["admin", "manager"], ["manager", "admin"])).toBe(true);
  });
  it("ignores duplicates", () => {
    expect(rolesEqual(["admin", "admin", "manager"], ["manager", "admin"])).toBe(true);
  });
  it("returns false for different role sets", () => {
    expect(rolesEqual(["admin"], ["manager"])).toBe(false);
    expect(rolesEqual(["admin"], ["admin", "manager"])).toBe(false);
  });
  it("returns true for two empty lists", () => {
    expect(rolesEqual([], [])).toBe(true);
  });
});

describe("background revalidation", () => {
  it("does NOT re-set roles when the server returns the same set in a different order", async () => {
    const uid = "user-revalidate-same";
    seedCache(uid, ["admin", "manager"]);
    currentSession = makeSession(uid);

    let bgResolve: (v: any) => void = () => {};
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => new Promise((res) => { bgResolve = res; }),
      }),
    });

    const snapshots: ReturnType<typeof useAuth>[] = [];
    renderWithAuth((v) => snapshots.push(v));

    await waitFor(() => {
      expect(snapshots[snapshots.length - 1].loading).toBe(false);
    });

    const rolesArrayBefore = snapshots[snapshots.length - 1].roles;
    const snapshotCountBefore = snapshots.length;

    // Server returns the same roles in reversed order — should NOT trigger
    // a state update / re-render with a new roles array.
    await act(async () => {
      bgResolve({
        data: [{ role: "manager" }, { role: "admin" }],
        error: null,
      });
    });

    // Allow any (potential) extra renders to flush.
    await new Promise((r) => setTimeout(r, 20));

    const rolesArrayAfter = snapshots[snapshots.length - 1].roles;
    // Identity preserved => setRoles was not called with a new array.
    expect(rolesArrayAfter).toBe(rolesArrayBefore);
    // No additional render caused by a roles state update.
    // (We allow a small slack for unrelated state like rolesError clearing.)
    const extraRenders = snapshots.length - snapshotCountBefore;
    expect(extraRenders).toBeLessThanOrEqual(1);
  });
});

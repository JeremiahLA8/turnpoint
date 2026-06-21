import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "technician" | "client";

type SignInResult = { error: Error | null; roles: AppRole[] };

type AuthCtx = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  /** True until BOTH session and roles (if logged in) are resolved. */
  loading: boolean;
  /** Set when role loading fails or exceeds the timeout. */
  rolesError: string | null;
  /** Re-attempt loading the current user's roles. */
  reloadRoles: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  roles: [],
  loading: true,
  rolesError: null,
  reloadRoles: async () => {},
  signIn: async () => ({ error: new Error("not ready"), roles: [] }),
  signOut: async () => {},
});

const ROLE_LOAD_TIMEOUT_MS = 8000;
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ROLE_CACHE_KEY = "sweepr.roles.v1";

type RoleCache = { uid: string; roles: AppRole[]; ts: number };

/**
 * Order-independent, duplicate-safe equality check for two role lists.
 * Two role sets are equal iff they contain exactly the same distinct roles.
 */
export const rolesEqual = (a: AppRole[], b: AppRole[]): boolean => {
  if (a === b) return true;
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const r of sa) if (!sb.has(r)) return false;
  return true;
};

/** Read the cache entry, regardless of whether it's valid for any user. */
const peekRoleCache = (): RoleCache | null => {
  try {
    const raw = localStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RoleCache;
  } catch {
    return null;
  }
};

const readRoleCache = (uid: string): AppRole[] | null => {
  const c = peekRoleCache();
  if (!c) return null;
  if (c.uid !== uid) {
    // Stale entry belongs to a different user — purge so it cannot leak.
    clearRoleCache();
    return null;
  }
  if (Date.now() - c.ts > ROLE_CACHE_TTL_MS) {
    clearRoleCache();
    return null;
  }
  return c.roles;
};

const writeRoleCache = (uid: string, roles: AppRole[]) => {
  try {
    const payload: RoleCache = { uid, roles, ts: Date.now() };
    localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
};

export const clearRoleCache = () => {
  try { localStorage.removeItem(ROLE_CACHE_KEY); } catch { /* ignore */ }
};

/**
 * If the persisted cache belongs to a different user than `currentUid`,
 * purge it. Returns true when a mismatch was detected and cleared.
 */
const purgeIfUidMismatch = (currentUid: string): boolean => {
  const c = peekRoleCache();
  if (c && c.uid !== currentUid) {
    clearRoleCache();
    return true;
  }
  return false;
};

/**
 * Synchronously read the persisted Supabase session from localStorage and
 * return the user id, if any. Used to hydrate cached roles on the very first
 * render — before `supabase.auth.getSession()` resolves — so a full browser
 * restart still shows the dashboard instantly (within TTL).
 */
const readPersistedUid = (): string | null => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const uid = parsed?.user?.id ?? parsed?.currentSession?.user?.id;
      if (typeof uid === "string") return uid;
    }
  } catch { /* ignore */ }
  return null;
};

/** Initial roles state: cached roles for the persisted session, if fresh. */
const initialCachedRoles = (): AppRole[] => {
  const uid = readPersistedUid();
  if (!uid) return [];
  return readRoleCache(uid) ?? [];
};

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); },
           (e) => { clearTimeout(t); reject(e); });
  });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>(() => initialCachedRoles());
  const [sessionReady, setSessionReady] = useState(false);
  const [rolesReady, setRolesReady] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  // Fetch roles from the server (with timeout). Writes to cache on success.
  const fetchRoles = async (uid: string): Promise<AppRole[]> => {
    setRolesError(null);
    try {
      const { data, error } = await withTimeout(
        Promise.resolve(
          supabase.from("user_roles").select("role").eq("user_id", uid),
        ),
        ROLE_LOAD_TIMEOUT_MS,
      );
      if (error) throw error;
      const next = (data ?? []).map((r: { role: AppRole }) => r.role);
      writeRoleCache(uid, next);
      return next;
    } catch (e: any) {
      console.error("fetchRoles", e);
      const msg =
        e?.message === "timeout"
          ? "Loading your permissions is taking longer than expected."
          : e?.message ?? "Failed to load your permissions.";
      setRolesError(msg);
      throw e;
    }
  };

  // Cache-first: hydrate from a fresh cached value (instant), then revalidate
  // silently in the background. Falls back to full network load on miss.
  const loadRoles = async (uid: string): Promise<AppRole[]> => {
    const cached = readRoleCache(uid);
    if (cached) {
      setRoles(cached);
      setRolesReady(true);
      // Background revalidate — don't block, don't surface errors.
      fetchRoles(uid)
        .then((fresh) => {
          if (!rolesEqual(fresh, cached)) setRoles(fresh);
          setRolesError(null);
        })
        .catch(() => { /* keep using cached value */ });
      return cached;
    }
    setRolesReady(false);
    try {
      const fresh = await fetchRoles(uid);
      setRoles(fresh);
      setRolesReady(true);
      return fresh;
    } catch {
      setRolesReady(true); // unblock UI; rolesError already set
      return [];
    }
  };

  // Manual refresh: bypass cache entirely.
  const reloadRoles = async () => {
    if (!user) return;
    setRolesReady(false);
    try {
      const fresh = await fetchRoles(user.id);
      setRoles(fresh);
    } catch {
      /* rolesError set */
    } finally {
      setRolesReady(true);
    }
  };

  // Tracks the user id we have already kicked off a role load for. Supabase's
  // onAuthStateChange fires for many events besides actual sign-in/out (token
  // refresh, cross-tab lock acquisition, visibility wake-ups, USER_UPDATED).
  // Without this guard, every such event resets rolesReady=false and refetches
  // roles, producing a sub-second spinner⇄dashboard flicker and a fetch
  // firehose against /rest/v1/user_roles.
  const lastLoadedUidRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const applySession = (s: Session | null) => {
      if (cancelled) return;
      const prevUid = userRef.current?.id ?? null;
      const nextUid = s?.user?.id ?? null;
      setSession(s);
      setUser(s?.user ?? null);

      // No-op auth event for the same user we already loaded — skip the
      // refetch. Token refreshes and other passive events go through here.
      if (nextUid && nextUid === lastLoadedUidRef.current) return;

      if (s?.user) {
        const uid = s.user.id;
        // If we switched accounts (or a stale cache for another user is
        // sitting in localStorage), drop any previously rendered roles and
        // purge the cache so we cannot leak permissions across users.
        const mismatch = purgeIfUidMismatch(uid);
        if (mismatch || (prevUid && prevUid !== uid)) {
          setRoles([]);
        }
        setRolesReady(false);
        setRolesError(null);
        lastLoadedUidRef.current = uid;
        setTimeout(() => {
          if (!cancelled) {
            // On mismatch, bypass cache entirely — always hit the server.
            if (mismatch) {
              fetchRoles(uid)
                .then((fresh) => { setRoles(fresh); })
                .catch(() => { /* rolesError set */ })
                .finally(() => setRolesReady(true));
            } else {
              loadRoles(uid);
            }
          }
        }, 0);
      } else {
        lastLoadedUidRef.current = null;
        setRoles([]);
        setRolesReady(true);
        setRolesError(null);
        clearRoleCache();
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      applySession(s);
      setSessionReady(true);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      applySession(s);
      setSessionReady(true);
    });

    // Cross-tab invalidation: if another tab clears or rewrites the cache,
    // keep this tab consistent. CRITICAL: if the other tab wrote a fresh entry
    // for the same user, adopt it directly — do NOT refetch, because every
    // fetchRoles() writes the cache, which fires storage in the other tab,
    // which refetches and writes, producing an infinite ping-pong that
    // manifests as both tabs flicker-reloading. Only refetch when the cache
    // was cleared (newValue === null) or belongs to a different user.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ROLE_CACHE_KEY) return;
      const u = userRef.current;
      if (!u) return;
      if (e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as RoleCache;
          if (parsed.uid === u.id && Date.now() - parsed.ts <= ROLE_CACHE_TTL_MS) {
            setRoles((prev) => (rolesEqual(parsed.roles, prev) ? prev : parsed.roles));
            return;
          }
        } catch { /* fall through to refetch */ }
      }
      purgeIfUidMismatch(u.id);
      setRolesReady(false);
      fetchRoles(u.id)
        .then((fresh) => setRoles(fresh))
        .catch(() => { /* rolesError set */ })
        .finally(() => setRolesReady(true));
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: error ?? new Error("Sign-in failed"), roles: [] };
    setSession(data.session);
    setUser(data.user);
    setSessionReady(true);
    // If a stale cache for another user is sitting in storage, purge it so
    // loadRoles() can't return their permissions to the new account.
    purgeIfUidMismatch(data.user.id);
    lastLoadedUidRef.current = data.user.id;
    const nextRoles = await loadRoles(data.user.id);
    return { error: null, roles: nextRoles };
  };

  const signOut = async () => {
    lastLoadedUidRef.current = null;
    clearRoleCache();
    await supabase.auth.signOut();
  };

  // Loading until session known AND (if logged in) roles resolved or errored.
  const loading = !sessionReady || (!!user && !rolesReady);

  return (
    <Ctx.Provider
      value={{ user, session, roles, loading, rolesError, reloadRoles, signIn, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);

// Landing route per role (highest priority first)
export const landingFor = (roles: AppRole[]): string => {
  if (roles.includes("admin")) return "/today";
  if (roles.includes("manager")) return "/today";
  if (roles.includes("technician")) return "/run";
  if (roles.includes("client")) return "/properties";
  return "/dashboard";
};

const ALL: AppRole[] = ["admin", "manager", "technician", "client"];
const STAFF: AppRole[] = ["admin", "manager"];
const OPS: AppRole[] = ["admin", "manager", "technician"];

// Single source of truth: which roles may access each route.
// Both <RequireAuth> and the sidebar consume this.
export const ROUTE_ROLES: Record<string, AppRole[]> = {
  "/today": STAFF,
  "/run": ["admin", "technician"],
  "/pay": STAFF,
  "/reports/owner": STAFF,
  "/dashboard": OPS,
  "/cleaner-search": STAFF,
  "/projects/schedule": OPS,
  "/projects/list": OPS,
  "/projects/reports": STAFF,
  "/property-problems": ALL,
  "/quality-center": STAFF,
  "/payments": ["admin", "client"],
  "/properties": ["admin", "manager", "client"],
  "/check-in": STAFF,
  "/checklists": OPS,
  "/inventory": STAFF,
  "/my-team": STAFF,
  "/guest-center": STAFF,
  "/host-services": STAFF,
  "/profile": ALL,
};

export const canAccess = (roles: AppRole[], path: string): boolean => {
  if (roles.length === 0) return false;
  // Exact match first
  const exact = ROUTE_ROLES[path];
  if (exact) return roles.some((r) => exact.includes(r));
  // Prefix match (e.g. /projects -> any /projects/* the user can reach)
  const matched = Object.entries(ROUTE_ROLES).filter(([p]) => p.startsWith(path + "/"));
  if (matched.length === 0) return false;
  return matched.some(([, allowed]) => roles.some((r) => allowed.includes(r)));
};


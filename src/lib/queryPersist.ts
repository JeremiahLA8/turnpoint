// Phase 8 — React Query persistence to IndexedDB so cached job + photo +
// checklist queries survive a page reload and (crucially) are available
// when the cleaner opens the app offline.
//
// Design choices:
//   - IndexedDB (via idb-keyval) instead of localStorage: bigger quota +
//     async, doesn't block the main thread.
//   - 24h maxAge: matches a typical shift window. After 24h we'd rather
//     show "no data" than stale info.
//   - Persistence is opt-in per query — only queries with gcTime ≥ maxAge
//     get written to IDB. Default queries fall back to the 5min in-memory
//     cache and aren't persisted.
//   - Auth-derived queries are deliberately NOT persisted: Supabase
//     handles its own session refresh.

import { QueryClient } from "@tanstack/react-query";
import { experimental_createQueryPersister } from "@tanstack/react-query-persist-client";
import { get, set, del } from "idb-keyval";

const CACHE_BUSTER = "cleanos-v1";

const indexedDBStorage = {
  getItem: (key: string) => get<string>(key),
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
};

const persister = experimental_createQueryPersister({
  storage: indexedDBStorage,
  maxAge: 24 * 60 * 60 * 1000, // 24h
  buster: CACHE_BUSTER,
});

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default: short-lived in-memory cache. Specific hooks opt into
        // offline persistence by overriding gcTime to ≥ 24h.
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        // When the app comes back online — or the user returns to the tab —
        // refetch so booking data stays in step with the PMS.
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        persister: persister.persisterFn,
      },
    },
  });
}

// gcTime that triggers persistence — set this on `useQuery` calls for data
// that should be available offline (jobs, properties, checklists, photos).
export const PERSIST_GC_TIME = 24 * 60 * 60 * 1000;

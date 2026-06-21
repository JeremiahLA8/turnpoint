import { useSyncExternalStore } from "react";
import { problems as seedProblems, type Problem } from "@/data/mockData";

let state: Problem[] = [...seedProblems];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const problemsStore = {
  getAll: () => state,
  getById: (id: string) => state.find((p) => p.id === id) ?? null,
  setStatus: (id: string, status: Problem["status"]) => {
    state = state.map((p) => (p.id === id ? { ...p, status } : p));
    emit();
  },
  add: (p: Problem) => {
    state = [p, ...state];
    emit();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const useProblems = (): Problem[] =>
  useSyncExternalStore(problemsStore.subscribe, problemsStore.getAll, problemsStore.getAll);

export const useProblem = (id: string | undefined): Problem | null =>
  useSyncExternalStore(
    problemsStore.subscribe,
    () => (id ? problemsStore.getById(id) : null),
    () => (id ? problemsStore.getById(id) : null),
  );

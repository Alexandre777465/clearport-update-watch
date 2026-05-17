import { useSyncExternalStore } from "react";

type State = { saved: string[]; dismissed: string[] };
const KEY = "clearport.alertState.v1";

function read(): State {
  if (typeof window === "undefined") return { saved: [], dismissed: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { saved: [], dismissed: [] };
    const parsed = JSON.parse(raw);
    return { saved: parsed.saved ?? [], dismissed: parsed.dismissed ?? [] };
  } catch {
    return { saved: [], dismissed: [] };
  }
}

let state = read();
const listeners = new Set<() => void>();

function emit() {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const serverSnap: State = { saved: [], dismissed: [] };
function getSnapshot() {
  return state;
}
function getServerSnapshot() {
  return serverSnap;
}

export function useAlertState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function toggleSaved(id: string) {
  state = state.saved.includes(id)
    ? { ...state, saved: state.saved.filter((x) => x !== id) }
    : { ...state, saved: [...state.saved, id], dismissed: state.dismissed.filter((x) => x !== id) };
  emit();
}

export function dismissAlert(id: string) {
  if (state.dismissed.includes(id)) return;
  state = { saved: state.saved.filter((x) => x !== id), dismissed: [...state.dismissed, id] };
  emit();
}

export function restoreAlert(id: string) {
  state = { ...state, dismissed: state.dismissed.filter((x) => x !== id) };
  emit();
}

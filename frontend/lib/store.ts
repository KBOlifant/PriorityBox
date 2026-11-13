import { useSyncExternalStore } from "react";
import { baseMessages } from "./mock-data";
import type { Filter, Message, Priority } from "./types";
import type { AccountStatus } from "@/services/mail/types";

export interface SyncState {
  status: "idle" | "loading" | "classifying" | "ready" | "error";
  error?: string;
  accounts: AccountStatus[];
}

type Overrides = Record<
  string,
  { priority?: Priority; remarks?: string; archived?: boolean; completedAt?: number }
>;
type OnboardingStep = 1 | 2 | null;

export interface State {
  messages: Message[];
  query: string;
  filter: Filter;
  onboarding: OnboardingStep;
  onboarded: boolean;
  /** True while showing the built-in sample messages (no account connected). */
  usingSample: boolean;
  sync: SyncState;
}

const STORAGE_KEY = "priority:v1";
const listeners = new Set<() => void>();

let overrides: Overrides = {};
let hydrated = false;
/** Messages before the user's own edits: sample data, or the connected inboxes. */
let source: Message[] = baseMessages;
let state: State = {
  messages: baseMessages,
  query: "",
  filter: "All",
  onboarding: null,
  onboarded: true,
  usingSample: true,
  sync: { status: "idle", accounts: [] },
};
const serverState = state;

const applyOverrides = (o: Overrides): Message[] =>
  source.map((m) => ({ ...m, ...o[m.id] }));

/** Reads saved edits once on the client. Server and first render use `serverState`. */
function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  let saved: { overrides?: Overrides; onboarded?: boolean } = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    saved = {};
  }
  overrides = saved.overrides ?? {};
  const onboarded = saved.onboarded === true;
  state = {
    ...state,
    messages: applyOverrides(overrides),
    onboarded,
    onboarding: onboarded ? null : 1,
  };
}

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ overrides, onboarded: state.onboarded }),
    );
  } catch {
    /* storage unavailable — edits simply won't persist */
  }
}

function update(patch: Partial<State>, save = false) {
  hydrate();
  state = { ...state, ...patch };
  if (save) persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useStore(): State {
  return useSyncExternalStore(
    subscribe,
    () => {
      hydrate();
      return state;
    },
    () => serverState,
  );
}

export const actions = {
  /** Swap the message source: real mail, or null to go back to the sample data. */
  setSource(list: Message[] | null) {
    source = list ?? baseMessages;
    update({ messages: applyOverrides(overrides), usingSample: list === null });
  },
  setSync: (patch: Partial<SyncState>) => update({ sync: { ...state.sync, ...patch } }),
  setQuery: (query: string) => update({ query }),
  setFilter: (filter: Filter) => update({ filter }),
  setPriority(id: string, priority: Priority) {
    overrides = { ...overrides, [id]: { ...overrides[id], priority } };
    update({ messages: applyOverrides(overrides) }, true);
  },
  setRemarks(id: string, remarks: string) {
    overrides = { ...overrides, [id]: { ...overrides[id], remarks } };
    update({ messages: applyOverrides(overrides) }, true);
  },
  complete(id: string) {
    overrides = {
      ...overrides,
      [id]: { ...overrides[id], archived: true, completedAt: Date.now() },
    };
    update({ messages: applyOverrides(overrides) }, true);
  },
  openConnect: () => update({ onboarding: 2 }),
  nextStep: () => update({ onboarding: 2 }),
  back() {
    update(state.onboarded ? { onboarding: null } : { onboarding: 1 });
  },
  finishOnboarding: () => update({ onboarding: null, onboarded: true }, true),
};

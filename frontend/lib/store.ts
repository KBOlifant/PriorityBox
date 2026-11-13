import { useSyncExternalStore } from "react";
import { baseMessages } from "./mock-data";
import type { Filter, Message, Priority } from "./types";
import { manualToMessage } from "./manual-map";
import type { ManualEntry } from "@/services/firestore/manualEntries";
import type { SavedRef } from "@/services/firestore/savedEmails";
import type { AccountStatus } from "@/services/mail/types";

export interface SyncState {
  status: "idle" | "loading" | "classifying" | "ready" | "error";
  error?: string;
  accounts: AccountStatus[];
  /** Page being viewed (1-based). */
  page: number;
  /** How many pages have been fetched so far. */
  loadedPages: number;
  /** True while the inboxes have more mail to fetch. */
  hasMore: boolean;
  /** Set while showing a saved copy of the inbox (epoch ms it was fetched), until live mail loads. */
  cachedAt?: number;
}

/** A search result chosen by the AI: only these messages are shown. */
export interface AiFilter {
  ids: string[];
  query: string;
}

type Overrides = Record<
  string,
  { priority?: Priority; remarks?: string; archived?: boolean; completedAt?: number }
>;
type OnboardingStep = 1 | 2 | null;
export type Mode = "mail" | "manual";

/** The fields of a manual entry a card can change directly. */
export type ManualEdit = Partial<Pick<ManualEntry, "priority" | "remarks" | "archived" | "completedAt">>;

export interface State {
  messages: Message[];
  query: string;
  filter: Filter;
  onboarding: OnboardingStep;
  onboarded: boolean;
  /** True while showing the built-in sample messages (no account connected). */
  usingSample: boolean;
  sync: SyncState;
  aiFilter: AiFilter | null;
  /** The user's own definitions of "urgent", applied to future classification. */
  rules: string[];
  /** How many hours emails are kept on this device so they survive a refresh. 0 = don't keep. */
  cacheHours: number;
  /** Saved-for-later references, including ones the user removed (kept as markers). */
  saved: SavedRef[];
  /** True once the saved list has been read from Firestore, so auto-save can't create duplicates. */
  savedLoaded: boolean;
  /** "mail" shows the connected inboxes; "manual" shows entries the user typed in. */
  mode: Mode;
  manual: ManualEntry[];
  /** The manual entry form: null = closed, {} = new entry, {id} = editing that entry. */
  manualEditor: { id?: string; saved?: boolean } | null;
}

const MAX_RULES = 5;
export const DEFAULT_CACHE_HOURS = 24;
const STORAGE_KEY = "priority:v1";
const listeners = new Set<() => void>();

let overrides: Overrides = {};
let hydrated = false;
/** Mail messages before the user's own edits: sample data, or the connected inboxes. */
let mailSource: Message[] = baseMessages;
let mailIsSample = true;
/** Manual entries as cards, before the user's own edits. */
let manualSource: Message[] = [];
/** Saves edits made on a manual card back to its record. */
let editSink: ((id: string, patch: ManualEdit) => void) | null = null;
let state: State = {
  messages: baseMessages,
  query: "",
  filter: "All",
  onboarding: null,
  onboarded: true,
  usingSample: true,
  sync: { status: "idle", accounts: [], page: 1, loadedPages: 0, hasMore: false },
  aiFilter: null,
  rules: [],
  cacheHours: DEFAULT_CACHE_HOURS,
  saved: [],
  savedLoaded: false,
  mode: "mail",
  manual: [],
  manualEditor: null,
};
const serverState = state;

const activeSource = () => (state.mode === "manual" ? manualSource : mailSource);

const applyOverrides = (o: Overrides): Message[] =>
  activeSource().map((m) => ({ ...m, ...o[m.id] }));

/** Sample data is only ever shown in mail mode. */
const isSample = () => state.mode === "mail" && mailIsSample;

/**
 * Manual cards are edited on the entry itself (the record is the source of truth),
 * not through the browser-side overrides used for connected mail.
 * Returns true if the edit was handled that way.
 */
function editManual(id: string, patch: ManualEdit): boolean {
  if (!id.startsWith("manual:")) return false;
  editSink?.(id.slice("manual:".length), patch);
  return true;
}

/** Reads saved edits once on the client. Server and first render use `serverState`. */
function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  let saved: {
    overrides?: Overrides;
    onboarded?: boolean;
    rules?: string[];
    cacheHours?: number;
    mode?: Mode;
  } = {};
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
    rules: Array.isArray(saved.rules) ? saved.rules.slice(0, MAX_RULES) : [],
    cacheHours:
      typeof saved.cacheHours === "number" && saved.cacheHours >= 0
        ? saved.cacheHours
        : DEFAULT_CACHE_HOURS,
    mode: saved.mode === "manual" ? "manual" : "mail",
  };
  // The saved mode decides which messages are shown.
  state = { ...state, messages: applyOverrides(overrides), usingSample: isSample() };
}

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        overrides,
        onboarded: state.onboarded,
        rules: state.rules,
        cacheHours: state.cacheHours,
        mode: state.mode,
      }),
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
    mailSource = list ?? baseMessages;
    mailIsSample = list === null;
    update({ messages: applyOverrides(overrides), usingSample: isSample() });
  },
  setMode(mode: Mode) {
    hydrate();
    state = { ...state, mode };
    // A search result from the other mode would point at messages that aren't shown.
    update({ messages: applyOverrides(overrides), usingSample: isSample(), aiFilter: null }, true);
  },
  setManual(manual: ManualEntry[]) {
    manualSource = manual.map(manualToMessage);
    update({ manual, messages: applyOverrides(overrides) });
  },
  openManualEditor: (id?: string, saved = false) =>
    update({ manualEditor: id ? { id, saved } : {} }),
  closeManualEditor: () => update({ manualEditor: null }),
  /** Re-marks several messages at once (from the AI bar). */
  setPriorities(changes: Record<string, Priority>) {
    for (const [id, priority] of Object.entries(changes)) {
      if (editManual(id, { priority })) continue;
      overrides = { ...overrides, [id]: { ...overrides[id], priority } };
    }
    update({ messages: applyOverrides(overrides) }, true);
  },
  setAiFilter: (aiFilter: AiFilter | null) => update({ aiFilter }),
  setCacheHours: (cacheHours: number) => update({ cacheHours }, true),
  /** `complete` is false for a first look at the copy kept on this device, before the server has answered. */
  setSaved: (saved: SavedRef[], complete = true) =>
    update({ saved, savedLoaded: state.savedLoaded || complete }),
  /** Adds or replaces one saved reference (matched by id). */
  upsertSaved(ref: SavedRef) {
    update({ saved: [ref, ...state.saved.filter((s) => s.id !== ref.id)] });
  },
  addRule(rule: string) {
    if (state.rules.includes(rule)) return;
    update({ rules: [rule, ...state.rules].slice(0, MAX_RULES) }, true);
  },
  removeRule: (rule: string) =>
    update({ rules: state.rules.filter((r) => r !== rule) }, true),
  setSync: (patch: Partial<SyncState>) => update({ sync: { ...state.sync, ...patch } }),
  setQuery: (query: string) => update({ query }),
  setFilter: (filter: Filter) => update({ filter }),
  setPriority(id: string, priority: Priority) {
    if (editManual(id, { priority })) return;
    overrides = { ...overrides, [id]: { ...overrides[id], priority } };
    update({ messages: applyOverrides(overrides) }, true);
  },
  setRemarks(id: string, remarks: string) {
    if (editManual(id, { remarks })) return;
    overrides = { ...overrides, [id]: { ...overrides[id], remarks } };
    update({ messages: applyOverrides(overrides) }, true);
  },
  complete(id: string) {
    const completedAt = Date.now();
    if (editManual(id, { archived: true, completedAt })) return;
    overrides = {
      ...overrides,
      [id]: { ...overrides[id], archived: true, completedAt },
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

/** Current rules, for non-React code. */
export function getRules(): string[] {
  hydrate();
  return state.rules;
}

/** Current saved references, for non-React code. */
export function getSaved(): SavedRef[] {
  hydrate();
  return state.saved;
}

/** Current cache lifetime in hours, for non-React code. */
export function getCacheHours(): number {
  hydrate();
  return state.cacheHours;
}

/** Current manual entries, for non-React code. */
export function getManual(): ManualEntry[] {
  hydrate();
  return state.manual;
}

/** Registers (or with null removes) the function that saves edits made on manual cards. */
export function setEditSink(fn: ((id: string, patch: ManualEdit) => void) | null) {
  editSink = fn;
}

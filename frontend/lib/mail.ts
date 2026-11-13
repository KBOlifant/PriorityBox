import { toMessage } from "./mail-map";
import { actions, getCacheHours, getRules } from "./store";
import * as store from "@/services/firestore";
import {
  MailPager,
  openPager,
  providers,
  sourceId,
  type ProviderId,
} from "@/services/mail";
import { clearMailCache, loadMailCache, saveMailCache, type CachedMail } from "@/services/mailCache";
import { classifyMail } from "@/services/mail/classify";
import type { AccountStatus, Classification, RawMail } from "@/services/mail/types";
import { safely } from "@/services/safely";

/** Messages per page. Each "next page" fetches this many more. */
export const PAGE_SIZE = 25;

interface Session {
  uid: string;
  pager: MailPager;
  statuses: AccountStatus[];
  /** Fetched pages, oldest page first. */
  pages: RawMail[][];
  analysis: Record<string, Classification>;
  /** False while only showing a saved copy; only live sessions refresh the cache. */
  live: boolean;
}

let session: Session | null = null;
let running: Promise<void> | null = null;
let again = false;
/** True while a page is being fetched from the mailboxes. */
let fetching = false;
/** AI analyses run one after another; this chains them and counts the unfinished ones. */
let analysisQueue: Promise<void> = Promise.resolve();
let pendingAnalyses = 0;

/**
 * Loads page 1 of every connected inbox and shows it right away; the AI
 * priority / dates / progress fill in afterwards. Calls made during a sync
 * queue one more run.
 */
export function syncMail(uid: string): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await run(uid);
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function run(uid: string) {
  actions.setSync({ status: "loading", error: undefined });

  const saved = await safely("list mail accounts", () => store.listMailAccounts(uid));
  if (saved === null) {
    actions.setSync({ status: "error", error: "Couldn’t load your connected accounts." });
    return;
  }
  if (!saved.length) {
    session = null;
    clearMailCache(uid);
    actions.setSource(null); // nothing connected: sample data
    actions.setSync({
      status: "idle",
      accounts: [],
      page: 1,
      loadedPages: 0,
      hasMore: false,
    });
    return;
  }

  // Show the copy kept on this device straight away, so a refresh doesn't empty the inbox.
  const cached = loadMailCache(uid, getCacheHours());
  if (cached) showCached(uid, cached, saved.map((a) => ({ ...a, status: "ok" as const })));

  const { pager, statuses } = await openPager(saved, PAGE_SIZE);

  // No account could be reached (login expired): keep showing the saved copy.
  if (cached && !statuses.some((a) => a.status === "ok")) {
    actions.setSync({ accounts: statuses, status: "ready", cachedAt: cached.fetchedAt });
    return;
  }
  await startSession(uid, pager, statuses);
}

function showCached(uid: string, c: CachedMail, statuses: AccountStatus[]) {
  // An empty pager means "no more mail", so only the saved pages can be paged through.
  session = {
    uid,
    pager: new MailPager([], PAGE_SIZE),
    statuses,
    pages: c.pages,
    analysis: c.analysis,
    live: false,
  };
  render(session);
  actions.setSync({
    accounts: statuses,
    page: 1,
    loadedPages: c.pages.length,
    hasMore: false,
    status: "loading",
    cachedAt: c.fetchedAt,
    error: undefined,
  });
}

/** Keeps the on-device copy current. Only live data is saved, never a copy of a copy. */
function persist(s: Session) {
  if (!s.live || !s.pages.length) return;
  saveMailCache(
    s.uid,
    { fetchedAt: Date.now(), pages: s.pages, analysis: s.analysis },
    getCacheHours(),
  );
}

/** Starts paging through `pager`. Exported so the paging flow can be exercised with fake sources. */
export async function startSession(uid: string, pager: MailPager, statuses: AccountStatus[]) {
  session = { uid, pager, statuses, pages: [], analysis: {}, live: true };
  actions.setSync({ accounts: statuses, page: 1, loadedPages: 0, hasMore: true });
  await fetchNextPage(session);
}

/**
 * Fetches the next batch from the inboxes and shows it. The AI analysis is
 * queued rather than awaited, so paging stays responsive while it runs.
 */
async function fetchNextPage(s: Session) {
  if (fetching) return;
  fetching = true;
  let mail: RawMail[] = [];
  try {
    actions.setSync({ status: "loading", error: undefined });
    mail = await s.pager.nextPage();

    // An account that broke mid-paging is flagged so the user can reconnect it.
    if (s.pager.failures.length) {
      const broken = new Map(s.pager.failures.map((f) => [f.source, f.error.message]));
      s.statuses = s.statuses.map((a) =>
        broken.has(sourceId(a))
          ? { ...a, status: "needs-reconnect", error: broken.get(sourceId(a)) }
          : a,
      );
    }

    if (mail.length) s.pages.push(mail);
    render(s);
    persist(s);
    actions.setSync({
      cachedAt: undefined,
      accounts: s.statuses,
      page: Math.max(1, s.pages.length),
      loadedPages: s.pages.length,
      hasMore: s.pager.hasMore,
      status: pendingAnalyses > 0 || mail.length ? "classifying" : "ready",
    });
  } catch (err) {
    actions.setSync({
      status: "error",
      error: err instanceof Error ? err.message : "Couldn’t load more mail.",
    });
  } finally {
    fetching = false;
  }
  if (mail.length) queueAnalysis(s, mail);
}

function queueAnalysis(s: Session, mail: RawMail[]) {
  pendingAnalyses += 1;
  analysisQueue = analysisQueue.then(() => analyse(s, mail));
}

async function analyse(s: Session, mail: RawMail[]) {
  let error: string | undefined;
  try {
    Object.assign(s.analysis, await classifyMail(s.uid, mail, getRules()));
    if (session === s) render(s);
    persist(s);
  } catch (err) {
    error = err instanceof Error ? err.message : "Couldn’t analyse your mail.";
  }
  pendingAnalyses -= 1;
  actions.setSync({ status: pendingAnalyses > 0 ? "classifying" : "ready", error });
}

function render(s: Session) {
  actions.setSource(
    s.pages.flatMap((page, i) =>
      page.map((m) => toMessage(m, s.analysis[m.id], i + 1)),
    ),
  );
}

/**
 * Moves to a page. Pages already fetched are instant; the page after the last
 * one fetches the next batch.
 */
export async function goToPage(n: number) {
  const s = session;
  if (!s || running || n < 1) return;
  if (n <= s.pages.length) {
    actions.setSync({ page: n });
    return;
  }
  if (n === s.pages.length + 1 && s.pager.hasMore) {
    await fetchNextPage(s);
    // The new page is the one the user asked for.
    if (session === s) actions.setSync({ page: s.pages.length });
  }
}

/** Interactive connect. Call directly from a click handler so pop-ups aren't blocked. */
export async function connectProvider(uid: string, id: ProviderId) {
  const account = await providers[id].connect();
  await safely("save mail account", () => store.saveMailAccount(uid, account));
  await syncMail(uid);
}

export async function disconnectProvider(uid: string, id: ProviderId, email: string) {
  await providers[id].disconnect(email).catch(() => undefined);
  clearMailCache(uid); // it may hold this account's mail
  await safely("remove mail account", () => store.removeMailAccount(uid, id));
  await syncMail(uid);
}

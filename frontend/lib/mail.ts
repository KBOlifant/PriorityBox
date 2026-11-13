import { toMessage } from "./mail-map";
import { actions } from "./store";
import * as store from "@/services/firestore";
import { loadMail, providers, type ProviderId } from "@/services/mail";
import { classifyMail } from "@/services/mail/classify";
import { safely } from "@/services/safely";

/** How many recent inbox messages to load per account. */
const LIMIT = 25;

let running: Promise<void> | null = null;
let again = false;

/**
 * Loads every connected inbox, shows it right away, then fills in the AI
 * priority / dates / progress. Calls made during a sync queue one more run.
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
    actions.setSource(null); // nothing connected: sample data
    actions.setSync({ status: "idle", accounts: [] });
    return;
  }

  const { mail, statuses } = await loadMail(saved, LIMIT);
  actions.setSource(mail.map((m) => toMessage(m)));
  actions.setSync({ accounts: statuses, status: mail.length ? "classifying" : "ready" });
  if (!mail.length) return;

  try {
    const analysis = await classifyMail(uid, mail);
    actions.setSource(mail.map((m) => toMessage(m, analysis[m.id])));
    actions.setSync({ status: "ready" });
  } catch (err) {
    actions.setSync({
      status: "ready",
      error: err instanceof Error ? err.message : "Couldn’t analyse your mail.",
    });
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
  await safely("remove mail account", () => store.removeMailAccount(uid, id));
  await syncMail(uid);
}

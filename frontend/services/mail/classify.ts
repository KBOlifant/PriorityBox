import { chat, SYSTEM_BASE } from "../groq";
import * as store from "../firestore";
import { safely } from "../safely";
import { parseClassifications } from "./classifyParse";
import type { Classification, RawMail } from "./types";

/**
 * Real mailboxes don't know about priority, deadlines or progress, so the model
 * derives them. Results are stored per message so each email is analysed once.
 */

const CHUNK = 8;
const BODY_CHARS = 700;

const PROMPT = `${SYSTEM_BASE}

You triage emails for the recipient. For EACH email return:
- "priority": "High" if the recipient must act or decide soon, or a deadline is within about a week; "Medium" if it is useful, informational with some follow-up, or waiting on others; "Low" for newsletters, receipts, notifications and anything needing no action.
- "waiting": true if the conversation is awaiting a reply, decision or follow-up involving the recipient, otherwise false.
- "event": the single most important date as {"label": up to 3 words, "date": "YYYY-MM-DD"}, or null if there is no concrete date. Resolve relative dates ("Thursday") using today's date.
- "stage": up to 4 words describing where this stands, e.g. "Awaiting your reply".
- "percent": integer 0-100, how complete the matter is.
- "tags": up to 2 short topic tags.

Reply with only JSON: {"results":[{"id":"<id as given>","priority":"","waiting":false,"event":null,"stage":"","percent":0,"tags":[]}]}`;

function describe(mail: RawMail[]): string {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
  const blocks = mail.map((m) =>
    [
      `### id: ${m.id}`,
      `From: ${m.fromName} <${m.fromEmail}>`,
      `Received: ${new Date(m.receivedAt).toISOString()}`,
      `Subject: ${m.subject}`,
      `Body: ${m.body.slice(0, BODY_CHARS)}`,
    ].join("\n"),
  );
  return `Today: ${today}\n\n${blocks.join("\n\n")}`;
}

/**
 * Returns a classification for every message it could analyse. Messages that
 * were analysed before come from Firestore; only new ones go to the model.
 */
export async function classifyMail(
  uid: string,
  mail: RawMail[],
): Promise<Record<string, Classification>> {
  if (!mail.length) return {};

  const known =
    (await safely("read classifications", () =>
      store.getClassifications(
        uid,
        mail.map((m) => m.id),
      ),
    )) ?? {};

  const results: Record<string, Classification> = { ...known };
  const fresh = mail.filter((m) => !known[m.id]);
  let lastError: unknown = null;

  for (let i = 0; i < fresh.length; i += CHUNK) {
    const chunk = fresh.slice(i, i + CHUNK);
    try {
      const reply = await chat(PROMPT, describe(chunk), 1800, { json: true });
      const parsed = parseClassifications(reply, new Set(chunk.map((m) => m.id)));
      for (const [id, c] of Object.entries(parsed)) {
        results[id] = c;
        await safely("save classification", () => store.saveClassification(uid, id, c));
      }
    } catch (err) {
      lastError = err;
    }
  }

  // Nothing at all worked: surface the reason instead of silently showing defaults.
  if (fresh.length && !Object.keys(results).length && lastError) throw lastError;
  return results;
}

// Pure parsing helpers with no app imports, so they can be tested on their own.
import type { RawMail } from "./types";

const MAX_BODY = 3000;

/**
 * Opens one message in Gmail on the web. The account goes in `authuser` (a path
 * like /u/me%40gmail.com/ is rejected with a 404) and the "all mail" view is used
 * so it works whether or not the message is still in the inbox.
 */
export function gmailLink(account: string, messageId: string): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(account)}#all/${encodeURIComponent(messageId)}`;
}

/**
 * The web link for a message, or null. Gmail links are always rebuilt here, because
 * messages saved or cached earlier carry a link in a format Gmail rejects.
 */
export function messageLink(m: {
  provider?: string;
  account?: string;
  /** "gmail:<id>" or "outlook:<id>". */
  id: string;
  webLink?: string;
}): string | null {
  if (m.provider === "gmail" && m.account) {
    return gmailLink(m.account, m.id.slice(m.id.indexOf(":") + 1));
  }
  return m.webLink?.startsWith("https://") ? m.webLink : null;
}

export function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Drops quoted replies and signatures-of-history, collapses whitespace, caps length. */
export function cleanBody(text: string, max = MAX_BODY): string {
  const lines: string[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    // Stop at the start of a quoted thread ("On <date>, X wrote:" / Outlook header block).
    if (/^on .{5,120} wrote:$/i.test(line)) break;
    if (/^-{2,}\s*(original message|forwarded message)\s*-{2,}$/i.test(line)) break;
    if (/^from:\s.+/i.test(line) && lines.length > 3) break;
    if (line.startsWith(">")) continue;
    lines.push(line);
  }
  const cleaned = lines
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned.length > max ? cleaned.slice(0, max).trimEnd() + "…" : cleaned;
}

/** Parses `"Name" <a@b.com>`, `Name <a@b.com>` or a bare address. */
export function parseFrom(header: string): { name: string; email: string } {
  const match = header.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const email = match[2].trim();
    return { name: match[1].trim() || email, email };
  }
  const email = header.trim();
  return { name: email, email };
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: { name: string; value: string }[] };
}

function findPart(part: GmailPart | undefined, mime: string): string | null {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const found = findPart(child, mime);
    if (found) return found;
  }
  return null;
}

export function extractGmailBody(msg: GmailMessage): string {
  const plain = findPart(msg.payload, "text/plain");
  if (plain) return plain;
  const html = findPart(msg.payload, "text/html");
  if (html) return htmlToText(html);
  return msg.snippet ?? "";
}

export function normalizeGmail(msg: GmailMessage, account: string): RawMail {
  const header = (name: string) =>
    msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  const from = parseFrom(header("from"));
  return {
    id: `gmail:${msg.id}`,
    provider: "gmail",
    account,
    fromName: from.name,
    fromEmail: from.email,
    subject: header("subject") || "(no subject)",
    body: cleanBody(extractGmailBody(msg)),
    receivedAt: Number(msg.internalDate) || Date.parse(header("date")) || 0,
    webLink: gmailLink(account, msg.id),
  };
}

export interface GraphMessage {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  webLink?: string;
}

export function normalizeGraph(msg: GraphMessage, account: string): RawMail {
  const addr = msg.from?.emailAddress;
  const content = msg.body?.content ?? msg.bodyPreview ?? "";
  const text = msg.body?.contentType?.toLowerCase() === "html" ? htmlToText(content) : content;
  return {
    id: `outlook:${msg.id}`,
    provider: "outlook",
    account,
    fromName: addr?.name || addr?.address || "Unknown sender",
    fromEmail: addr?.address ?? "",
    subject: msg.subject || "(no subject)",
    body: cleanBody(text),
    receivedAt: Date.parse(msg.receivedDateTime ?? "") || 0,
    webLink: msg.webLink,
  };
}

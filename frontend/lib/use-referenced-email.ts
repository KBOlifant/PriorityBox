"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { toMessage } from "./mail-map";
import { useStore } from "./store";
import type { Message } from "./types";
import { MailError, providers } from "@/services/mail";
import { loadStoredMail, storeMail } from "@/services/mailStore";

export interface EmailRef {
  messageId: string;
  provider: "gmail" | "outlook";
  account: string;
}

/**
 * The email behind a reference (a folder item), looked up in this order:
 * loaded in this session -> kept on this device (IndexedDB) -> fetched from the
 * mailbox by id. The device copy is checked on mount (no network); the mailbox is
 * only asked through `load`, and only `load(true)` (after a click) may show a sign-in.
 */
export function useReferencedEmail(ref: EmailRef) {
  const { user } = useAuth();
  const { messages } = useStore();
  const [fetched, setFetched] = useState<Message | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "needs-connect">("idle");
  const [error, setError] = useState("");

  const loaded = messages.find((m) => m.id === ref.messageId);
  const email = loaded?.body ? loaded : fetched;
  const uid = user?.uid;

  // A copy kept on this device costs nothing to show, so look for it straight away.
  useEffect(() => {
    if (!uid || loaded?.body) return;
    let live = true;
    void loadStoredMail(uid, [ref.messageId]).then((kept) => {
      const raw = kept.get(ref.messageId);
      if (live && raw) setFetched(toMessage(raw));
    });
    return () => {
      live = false;
    };
  }, [uid, ref.messageId, loaded?.body]);

  const appName = ref.provider === "gmail" ? "Gmail" : "Outlook";

  async function load(interactive: boolean): Promise<Message | null> {
    if (email) return email;
    setStatus("loading");
    setError("");
    try {
      const provider = providers[ref.provider];
      const ready = interactive
        ? await provider.restore(ref.account)
        : await provider.hasSession(ref.account);
      if (!ready) {
        if (!interactive) {
          setStatus("needs-connect");
          return null;
        }
        throw new MailError(
          `${provider.label} isn’t connected. Connect it to read this email, or open it in ${appName}.`,
        );
      }
      const raw = await provider.fetchMessage(ref.account, ref.messageId.slice(ref.messageId.indexOf(":") + 1));
      if (uid) void storeMail(uid, [raw]);
      const m = toMessage(raw);
      setFetched(m);
      setStatus("idle");
      return m;
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Couldn’t load this email.");
      return null;
    }
  }

  return { email, loaded, status, error, load, appName };
}

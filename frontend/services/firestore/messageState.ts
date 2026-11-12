import { orderBy } from "firebase/firestore";
import * as crud from "./crud";
import { USERS } from "./users";
import type { Priority } from "@/lib/types";

/** The user's own edits to a message: users/{uid}/messageState/{messageId}. */
export interface MessageState {
  priority?: Priority;
  remarks?: string;
}

const path = (uid: string) => `${USERS}/${uid}/messageState`;

/** Saves only the given fields, creating the document if it doesn't exist yet. */
export const saveMessageState = (
  uid: string,
  messageId: string,
  patch: MessageState,
) => crud.upsert<MessageState>(path(uid), messageId, patch);

export const getMessageState = (uid: string, messageId: string) =>
  crud.get<MessageState>(path(uid), messageId);

export const listMessageStates = (uid: string) =>
  crud.list<MessageState>(path(uid), orderBy("updatedAt", "desc"));

export const deleteMessageState = (uid: string, messageId: string) =>
  crud.remove(path(uid), messageId);

export const watchMessageStates = (
  uid: string,
  onChange: (states: crud.Stored<MessageState>[]) => void,
  onError?: (error: Error) => void,
) => crud.watch<MessageState>(path(uid), onChange, onError);

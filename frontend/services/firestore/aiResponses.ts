import * as crud from "./crud";
import { USERS } from "./users";

/** Saved AI output for one message: users/{uid}/aiResponses/{messageId}. */
export interface AiResponse {
  summary?: string;
  followUp?: string;
}

const path = (uid: string) => `${USERS}/${uid}/aiResponses`;

export const getAiResponse = (uid: string, messageId: string) =>
  crud.get<AiResponse>(path(uid), messageId);

export const saveSummary = (uid: string, messageId: string, summary: string) =>
  crud.upsert<AiResponse>(path(uid), messageId, { summary });

export const saveFollowUp = (
  uid: string,
  messageId: string,
  followUp: string,
) => crud.upsert<AiResponse>(path(uid), messageId, { followUp });

export const clearSummary = (uid: string, messageId: string) =>
  crud.clearFields(path(uid), messageId, ["summary"]);

export const clearFollowUp = (uid: string, messageId: string) =>
  crud.clearFields(path(uid), messageId, ["followUp"]);

/** Removes both the summary and the follow-up for a message. */
export const deleteAiResponse = (uid: string, messageId: string) =>
  crud.remove(path(uid), messageId);

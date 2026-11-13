export type Priority = "High" | "Medium" | "Low";
export type Filter = "All" | Priority;
export type PageKey =
  | "priority"
  | "all"
  | "waiting"
  | "events"
  | "archive"
  | "saved";

export interface MailEvent {
  label: string;
  date: string;
}

export interface Message {
  id: string;
  sender: string;
  email: string;
  initials: string;
  avatarColor: string;
  day: string;
  time: string;
  subject: string;
  preview: string;
  event?: MailEvent;
  priority: Priority;
  waiting: boolean;
  archived: boolean;
  /** Epoch ms when the user marked it complete. */
  completedAt?: number;
  progress: { stage: string; percent: number };
  tags: string[];
  remarks: string;
  /** Full plain-text body for real mail. Sample messages only have `preview`. */
  body?: string;
  /** Set for real mail, absent for sample data. */
  provider?: "gmail" | "outlook" | "manual";
  /** Opens the message in the provider's web mail. */
  webLink?: string;
  /** Which fetched page (1-based) a real message belongs to. */
  page?: number;
  /** The connected account (email address) a real message belongs to. */
  account?: string;
}

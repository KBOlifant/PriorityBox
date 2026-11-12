export type Priority = "High" | "Medium" | "Low";
export type Filter = "All" | Priority;
export type PageKey = "priority" | "all" | "waiting" | "events" | "archive";

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
  progress: { stage: string; percent: number };
  tags: string[];
  remarks: string;
}

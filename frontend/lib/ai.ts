import { auth } from "./firebase";
import type { Message } from "./types";

export type AiTask = "summary" | "draft";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Calls the backend AI endpoint; the Groq key lives only on the backend. */
export async function generate(
  task: AiTask,
  m: Message,
  userName: string,
): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Please sign in again.");

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        task,
        userName,
        message: {
          sender: m.sender,
          subject: m.subject,
          preview: m.preview,
          day: m.day,
          time: m.time,
          event: m.event,
          progress: m.progress,
          remarks: m.remarks,
        },
      }),
    });
  } catch {
    throw new Error("Can’t reach the server. Check your connection.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.text !== "string") {
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  }
  return data.text;
}

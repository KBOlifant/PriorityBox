import type { Message } from "./types";

export function mailtoHref(m: Message, body = "") {
  const params = new URLSearchParams({ subject: `Re: ${m.subject}` });
  if (body) params.set("body", body);
  // URLSearchParams encodes spaces as "+", which mail clients show literally.
  return `mailto:${m.email}?${params.toString().replace(/\+/g, "%20")}`;
}

export function downloadMessage(m: Message) {
  const lines = [
    `From: ${m.sender} <${m.email}>`,
    `Date: ${m.day}, ${m.time}`,
    `Subject: ${m.subject}`,
    "",
    m.preview,
  ];
  if (m.event) lines.push("", `${m.event.label}: ${m.event.date}`);
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${m.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

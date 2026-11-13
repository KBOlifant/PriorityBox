// Pure sender matching with no app imports, so it can be tested alone.

/** Lowercase, strip accents, and turn punctuation (including "@" and ".") into spaces. */
function words(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

/**
 * Does `term` (a name, an email address, or a company/domain) refer to this sender?
 * Every word of the term must start a word in the sender's name or address, so
 * "maya chen", "maya.chen@northwind.example" and "northwind" all match
 * Maya Chen <maya.chen@northwind.example>, while "chen" does not match "kitchen".
 */
export function matchesSender(
  sender: { sender: string; email: string },
  term: string,
): boolean {
  const wanted = words(term);
  if (!wanted.length) return false;
  const have = words(`${sender.sender} ${sender.email}`);
  return wanted.every((w) => have.some((h) => h.startsWith(w)));
}

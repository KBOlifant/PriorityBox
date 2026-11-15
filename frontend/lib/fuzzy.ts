// Pure, typo-tolerant word matching with no app imports, so it can be tested alone.

/** Lowercase, strip accents, keep letters and digits. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** The words of a text, normalized, at least 2 characters long. */
export function tokenize(s: string): string[] {
  return normalize(s).match(/[a-z0-9]{2,}/g) ?? [];
}

/**
 * Edit distance where a swap of two neighbouring letters counts as one edit
 * ("invocie" -> "invoice" is 1). Returns `max + 1` as soon as the distance is
 * known to exceed `max`, which keeps scanning a large vocabulary cheap.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** How many typos a word of this length may have and still match. */
export function allowedEdits(length: number): number {
  return length <= 3 ? 0 : length <= 6 ? 1 : 2;
}

/**
 * Does vocabulary word `word` match what the user typed (`term`, one word)?
 * - close spelling ("invocie" ~ "invoice"),
 * - longer forms ("invoic" -> "invoices"), also with a typo ("invocie" -> "invoices").
 */
export function wordMatches(term: string, word: string): boolean {
  if (word === term) return true;
  const k = allowedEdits(term.length);
  if (term.length >= 4 && word.startsWith(term)) return true;
  if (k === 0) return false;
  // People rarely mistype the first letter; requiring it stops "invoice" matching "voice".
  const sameStart = word[0] === term[0] || (word[0] === term[1] && word[1] === term[0]);
  if (!sameStart) return false;
  if (editDistance(term, word, k) <= k) return true;
  // A typo in the stem of a longer word: compare against the word's start.
  return (
    term.length >= 5 &&
    word.length > term.length &&
    editDistance(term, word.slice(0, term.length), k) <= k
  );
}

/** The vocabulary words a single typed word could mean, closest first, at most `limit`. */
export function expandWord(term: string, vocab: Iterable<string>, limit = 8): string[] {
  const t = normalize(term);
  const out: { w: string; d: number }[] = [];
  for (const w of vocab) {
    if (!wordMatches(t, w)) continue;
    out.push({ w, d: w === t ? -1 : editDistance(t, w.slice(0, Math.max(t.length, 1)), 3) });
  }
  return out
    .sort((a, b) => a.d - b.d || a.w.length - b.w.length)
    .slice(0, limit)
    .map((x) => x.w);
}

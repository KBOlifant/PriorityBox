// Pure paging logic with no app imports, so it can be tested alone.
import type { RawMail } from "./types";

export interface PageSource {
  /** Identifies the account, e.g. "gmail:me@gmail.com". */
  id: string;
  /** Loads one batch, newest first. `next` is the cursor for the batch after it; absent at the end. */
  fetch(cursor?: string): Promise<{ mail: RawMail[]; next?: string }>;
}

interface Stream {
  source: PageSource;
  buffer: RawMail[];
  cursor?: string;
  done: boolean;
}

export interface PagerFailure {
  source: string;
  error: Error;
}

/**
 * Merges several accounts into one newest-first feed and hands it out in pages
 * of exactly `pageSize`. Each account is fetched lazily, a batch at a time, so
 * moving to the next page only fetches what that page needs.
 */
export class MailPager {
  private streams: Stream[];
  private readonly pageSize: number;
  readonly failures: PagerFailure[] = [];

  constructor(sources: PageSource[], pageSize = 25) {
    this.pageSize = pageSize;
    this.streams = sources.map((source) => ({ source, buffer: [], done: false }));
  }

  /** True while any account has buffered or not-yet-fetched mail. */
  get hasMore(): boolean {
    return this.streams.some((s) => s.buffer.length > 0 || !s.done);
  }

  async nextPage(): Promise<RawMail[]> {
    const page: RawMail[] = [];
    while (page.length < this.pageSize) {
      // Every live account needs a message at the head of its buffer to compare.
      await Promise.all(
        this.streams.filter((s) => !s.buffer.length && !s.done).map((s) => this.refill(s)),
      );
      const live = this.streams.filter((s) => s.buffer.length > 0);
      if (!live.length) break;
      const newest = live.reduce((a, b) =>
        a.buffer[0].receivedAt >= b.buffer[0].receivedAt ? a : b,
      );
      page.push(newest.buffer.shift()!);
    }
    return page;
  }

  private async refill(s: Stream) {
    // A batch can come back empty while a cursor remains; allow a few hops.
    for (let hops = 0; hops < 5 && !s.buffer.length && !s.done; hops++) {
      try {
        const result = await s.source.fetch(s.cursor);
        s.buffer.push(...result.mail);
        s.cursor = result.next;
        s.done = !result.next;
      } catch (err) {
        this.failures.push({
          source: s.source.id,
          error: err instanceof Error ? err : new Error(String(err)),
        });
        s.done = true; // stop asking a broken account; the others keep going
      }
    }
    if (!s.buffer.length) s.done = true;
  }
}

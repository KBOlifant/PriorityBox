/** A card-shaped placeholder shown while the next page of mail is on its way. */
export function MessageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex gap-3 rounded-xl bg-surface p-3 shadow-sm shadow-black/10"
    >
      <span className="size-8 shrink-0 animate-pulse rounded-lg bg-track" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="h-3.5 w-40 max-w-[50%] animate-pulse rounded bg-track" />
          <span className="h-5 w-16 animate-pulse rounded-full bg-track" />
        </div>
        <span className="block h-3.5 w-3/5 animate-pulse rounded bg-track" />
        <span className="block h-3 w-4/5 animate-pulse rounded bg-track" />
      </div>
    </div>
  );
}

/** One page's worth of placeholders, announced once to screen readers rather than per card. */
export function MessageSkeletons({ count }: { count: number }) {
  return (
    <div role="status" aria-label="Loading your emails" className="grid items-stretch gap-3">
      {Array.from({ length: count }, (_, i) => (
        <MessageSkeleton key={i} />
      ))}
    </div>
  );
}

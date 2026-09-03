export function LiveBadge({ label = "LIVE" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-live/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-live">
      <span className="live-dot" />
      {label}
    </span>
  );
}

export function BucketReaction({ count }: { count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-1 text-xs font-semibold text-brand-2">
      <span aria-hidden>🪣</span>
      ΣΤΟΝ ΚΟΥΒΑ{typeof count === "number" ? ` ${count}` : ""}
    </span>
  );
}

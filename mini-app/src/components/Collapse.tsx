import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A drawer for content that arrives after first paint. Closed it takes no
 * room at all; opening slides everything below it down on one eased curve
 * instead of a single-frame jump (layout shift) — the difference between a
 * page that "loads" and one that lurches.
 *
 * Render it unconditionally and flip `open`; children can go on unmounting
 * when closed, but keep them mounted (see `useLast`) while it closes.
 */
export function Collapse({ open, children }: { open: boolean; children?: ReactNode }) {
  // Clip only while moving: at rest the content's shadows must reach past it.
  const [settled, setSettled] = useState(open);
  useEffect(() => { if (!open) setSettled(false); }, [open]);

  return (
    <div
      className="collapse"
      data-open={open}
      onTransitionEnd={e => {
        if (e.target === e.currentTarget && open) setSettled(true);
      }}
    >
      <div className="collapse__in" data-settled={open && settled}>{children}</div>
    </div>
  );
}

/** The last non-empty value — keeps a closing `Collapse` filled while it shuts. */
export function useLast<T>(value: T | null | undefined): T | null {
  const last = useRef<T | null>(null);
  if (value != null) last.current = value;
  return value ?? last.current;
}

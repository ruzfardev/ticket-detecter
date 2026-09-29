import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const LH = "1.16em";

function Digit({ n }: { n: number }) {
  return (
    <span className="relative inline-block overflow-hidden align-bottom" style={{ height: LH }}>
      {/* An invisible "0" gives the column its natural (tabular) width. */}
      <span className="invisible block leading-[1.16]">0</span>
      <m.span
        aria-hidden
        className="absolute inset-x-0 top-0 flex flex-col text-center"
        initial={false}
        animate={{ y: `${-n * 10}%` }}
        transition={spring.smooth}
      >
        {DIGITS.map(d => (
          <span key={d} style={{ height: LH, lineHeight: LH }}>{d}</span>
        ))}
      </m.span>
    </span>
  );
}

/**
 * A number whose digits roll like a departure board when it changes. Only the
 * digits that changed move. Non-digits (":" "/" " ") are set as text.
 */
export function Ticker({ value, className }: { value: number | string; className?: string }) {
  const s = String(value);
  return (
    <span className={cn("tnum inline-flex items-end", className)} role="text" aria-label={s}>
      {[...s].map((ch, i) => {
        // key by distance from the end so "9" → "10" grows a column, not reshuffles all
        const key = s.length - i;
        return /\d/.test(ch) ? <Digit key={key} n={Number(ch)} /> : <span key={key} style={{ lineHeight: LH }}>{ch}</span>;
      })}
    </span>
  );
}

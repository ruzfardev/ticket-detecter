import { cn } from "@/lib/utils";
import { RouteLine } from "@/components/RouteLine";

type End = {
  station: string;
  time: string;
  /** Days later than departure ("+1" on overnight trains). */
  plus?: number;
};

type Props = {
  dep: End;
  arr: End;
  /** Journey time, sat on the line. */
  duration?: string;
  /** "coral" lights the times up (the next trip, a selected train). */
  tone?: "ink" | "coral" | "muted" | "onPrimary";
  /** A train-dot rides the line. */
  moving?: boolean;
  className?: string;
};

const TIME = {
  ink: "text-ink",
  coral: "text-coral-ink",
  muted: "text-muted",
  onPrimary: "text-on-primary",
} as const;

/**
 * The face of a ticket: where from and when, where to and when, and the line
 * between. Times are large and tabular — read at arm's length on a platform —
 * with the stations as small caps above them.
 */
export function TripTimes({ dep, arr, duration, tone = "ink", moving, className }: Props) {
  const station = tone === "onPrimary" ? "text-on-primary/85" : "text-muted";
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <div className="min-w-0 max-w-[38%]">
        <div className={cn("truncate text-[11px] font-semibold uppercase tracking-[0.06em]", station)}>
          {dep.station || "—"}
        </div>
        <div className={cn("tnum text-[28px] font-semibold leading-[34px]", TIME[tone])}>{dep.time}</div>
      </div>

      <RouteLine label={duration} moving={moving} onPrimary={tone === "onPrimary"} />

      <div className="min-w-0 max-w-[38%] text-right">
        <div className={cn("truncate text-[11px] font-semibold uppercase tracking-[0.06em]", station)}>
          {arr.station || "—"}
        </div>
        <div className={cn("tnum text-[28px] font-semibold leading-[34px]", TIME[tone])}>
          {arr.time}
          {!!arr.plus && arr.plus > 0 && (
            <sup className={cn("ml-0.5 align-super text-[12px] font-semibold", station)}>+{arr.plus}</sup>
          )}
        </div>
      </div>
    </div>
  );
}

import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

const STEPS = [
  { path: "/new",          label: "Marshrut" },
  { path: "/new/date",     label: "Sana" },
  { path: "/new/train",    label: "Poyezd" },
  { path: "/new/car-type", label: "Vagon" },
  { path: "/new/berth",    label: "Joy" },
  { path: "/new/confirm",  label: "Tasdiq" },
];

type Props = {
  current: string;
  className?: string;
};

/**
 * Six capsules in the nav bar: finished steps are solid coral, the current one
 * is wider and glows, the rest are hollow. Widths spring, so moving on feels
 * like the row breathing. The label under it says where you are in words.
 */
export function WizardSteps({ current, className }: Props) {
  const idx = STEPS.findIndex(s => s.path === current);
  const step = idx >= 0 ? idx + 1 : 1;
  const label = idx >= 0 ? STEPS[idx].label : "";

  return (
    <div
      className={cn("flex flex-col items-center gap-1", className)}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-valuenow={step}
      aria-label={`${step}/${STEPS.length} · ${label}`}
    >
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => {
          const done = i < idx;
          const now = i === idx;
          return (
            <m.span
              key={s.path}
              initial={false}
              animate={{ width: now ? 26 : 8 }}
              transition={spring.bouncy}
              className={cn(
                "h-2 rounded-full transition-colors duration-300",
                done && "bg-coral",
                now && "bg-coral-bright shadow-[0_0_10px_hsl(var(--coral-bright)/0.7)]",
                !done && !now && "bg-ink/20 dark:bg-ink/25",
              )}
            />
          );
        })}
      </div>
      <span className="tnum text-[12px] font-semibold leading-none text-muted">
        {step}/{STEPS.length} · {label}
      </span>
    </div>
  );
}

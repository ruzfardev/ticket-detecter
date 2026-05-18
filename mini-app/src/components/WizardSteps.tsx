import { cn } from "@/lib/utils";

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
 * Minimal coral progress bar — shows wizard step out of total. Kept slim so
 * it doesn't compete with the Anthropic serif title underneath.
 */
export function WizardSteps({ current, className }: Props) {
  const idx = STEPS.findIndex(s => s.path === current);
  const total = STEPS.length;
  const step = idx >= 0 ? idx + 1 : 1;
  const label = idx >= 0 ? STEPS[idx].label : "";
  const pct = (step / total) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-caption-upper uppercase text-muted">
        <span>
          {step}/{total} · {label}
        </span>
      </div>
      <div className="h-1 rounded-pill bg-surface-card overflow-hidden">
        <div
          className="h-full bg-coral transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

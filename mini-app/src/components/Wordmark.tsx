import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const SIZE = {
  sm: "text-title-sm",
  md: "text-title-md",
  lg: "text-display-sm",
};

export function Wordmark({ className, size = "md" }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-display", SIZE[size], className)}>
      <span className="spike-mark text-ink" />
      <span className="font-medium tracking-tight">Ticket Detector</span>
    </span>
  );
}

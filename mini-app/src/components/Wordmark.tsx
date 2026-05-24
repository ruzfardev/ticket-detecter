import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const SIZE = {
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-20 w-20",
};

export function Wordmark({ className, size = "md" }: Props) {
  return (
    <img
      src="/logo.svg"
      alt="Ticket Detector"
      className={cn("block select-none", SIZE[size], className)}
    />
  );
}

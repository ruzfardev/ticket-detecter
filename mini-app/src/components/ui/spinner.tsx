import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = { sm: 16, md: 24, lg: 36 };

export function Spinner({ size = "md", className }: Props) {
  return (
    <Loader2
      size={SIZE[size]}
      strokeWidth={1.75}
      className={cn("animate-spin text-coral", className)}
    />
  );
}

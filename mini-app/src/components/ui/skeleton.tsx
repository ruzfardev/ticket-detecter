import { cn } from "@/lib/utils";

/** A placeholder with a soft light sweeping across it (styles/glass.css). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton", className)} {...props} />;
}

export { Skeleton };

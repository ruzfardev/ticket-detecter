import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  body?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

/** An in-page empty state: a quiet inset panel, not a full screen. */
export function EmptyNote({ title, body, icon: Icon, action, className }: Props) {
  return (
    <div className={cn("surface-soft flex flex-col items-center gap-2 px-6 py-9 text-center", className)}>
      {Icon && <Icon className="mb-1 size-8 text-muted-soft" strokeWidth={1.6} aria-hidden />}
      <p className="text-title-md text-ink">{title}</p>
      {body && <p className="max-w-[28ch] text-body-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

import type { ReactNode } from "react";
import * as m from "motion/react-m";
import { AlertTriangle, Inbox } from "lucide-react";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { Spinner } from "@/components/ui/spinner";
import { Screen } from "./Screen";

type Props = {
  kind: "loading" | "error" | "empty";
  header?: string;
  description?: string;
  action?: ReactNode;
};

/**
 * Loading, error and empty states share one composition: a glass medallion
 * carrying the state's glyph, a headline, a sentence, and (if there is a way
 * out) an action. The medallion springs in; a loading one breathes.
 */
export function StatusView({ kind, header, description, action }: Props) {
  return (
    <Screen center padded nav={false}>
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <m.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring.bouncy}
          className={cn(
            "glass flex size-[88px] items-center justify-center rounded-full",
            kind === "error" && "glass-tint [--tint:var(--error)]",
          )}
        >
          {kind === "loading" && <Spinner size="lg" />}
          {kind === "error" && <AlertTriangle className="size-9 text-error" strokeWidth={1.8} />}
          {kind === "empty" && <Inbox className="size-9 text-muted" strokeWidth={1.6} />}
        </m.div>

        {(header || description) && (
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.smooth, delay: 0.08 }}
            className="space-y-1.5"
          >
            {header && <h2 className="font-display text-display-md text-ink">{header}</h2>}
            {description && <p className="text-body-md text-muted">{description}</p>}
          </m.div>
        )}

        {action && (
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.smooth, delay: 0.16 }}
          >
            {action}
          </m.div>
        )}
      </div>
    </Screen>
  );
}

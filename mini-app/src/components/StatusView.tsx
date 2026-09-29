import { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Screen } from "./Screen";

type Props = {
  kind: "loading" | "error" | "empty";
  header?: string;
  description?: string;
  action?: ReactNode;
};

export function StatusView({ kind, header, description, action }: Props) {
  return (
    <Screen center padded>
      <div className="flex flex-col items-center text-center max-w-sm gap-3">
        {kind === "loading" && <Spinner size="lg" />}
        {kind === "error" && (
          <AlertTriangle className="h-10 w-10 text-error" strokeWidth={1.5} />
        )}
        {kind === "empty" && (
          <Inbox className="h-10 w-10 text-muted-soft" strokeWidth={1.5} />
        )}
        {(header || description) && (
          <div className="space-y-1">
            {header && (
              <h2 className="font-display text-display-sm text-ink">{header}</h2>
            )}
            {description && (
              <p className="text-body-md text-muted">{description}</p>
            )}
          </div>
        )}
        {action}
      </div>
    </Screen>
  );
}

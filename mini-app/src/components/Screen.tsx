import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WizardSteps } from "./WizardSteps";

type Props = {
  children: ReactNode;
  /** Reserve bottom space for the tabbar. */
  tabbed?: boolean;
  /** Center contents vertically (use on Welcome / StatusView). */
  center?: boolean;
  /** Add the standard horizontal page padding. */
  padded?: boolean;
  /** Show the wizard step indicator (auto-detects from current path). */
  wizard?: boolean;
  /** Optional title shown above content as a serif display heading. */
  title?: ReactNode;
  /** Optional subtitle paired with the title. */
  subtitle?: ReactNode;
  className?: string;
};

export function Screen({
  children,
  tabbed,
  center,
  padded = true,
  wizard,
  title,
  subtitle,
  className,
}: Props) {
  const location = useLocation();
  return (
    <div
      className={cn(
        "min-h-screen bg-canvas text-ink",
        "pt-5",
        tabbed
          ? "pb-[calc(var(--tabbar-h,64px)+env(safe-area-inset-bottom,0px)+28px)]"
          : "pb-[calc(env(safe-area-inset-bottom,0px)+20px)]",
        padded && "px-4",
        center && "flex flex-col items-center justify-center",
        className,
      )}
    >
      {wizard && <WizardSteps current={location.pathname} className="mb-4" />}
      {(title || subtitle) && (
        <header className="mb-5 space-y-1">
          {title && (
            <h1 className="font-display text-display-md tracking-tight text-ink">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-body-md text-muted">{subtitle}</p>
          )}
        </header>
      )}
      <div className="space-y-6">{children}</div>
    </div>
  );
}
